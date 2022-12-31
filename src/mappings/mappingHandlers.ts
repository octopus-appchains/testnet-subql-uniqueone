import { SubstrateBlock } from "@subql/types";
import { Block, Event, Extrinsic, Call, Account, SystemTokenTransfer, UpwardMessage, AppchainToNearTransfer, NearToAppchainTransfer } from "../types";
import { handleExtrinsic, wrapExtrinsics } from './extrinsics';
import { tryUpdateAccount, handleAccount } from './accounts';
import _ from "lodash";
import { handleUpwardMessages } from './bridgeMessages';
import { storeBridgeMessageEvent } from './bridgeEvents';
import { isEraEvent, isBridgeTransferEvent, isBridgeTransferEventOld } from './utils/matches';
import { config } from "../config";

export async function handleBlock(block: SubstrateBlock): Promise<void> {
  const newBlock = new Block(block.block.header.hash.toString())
  const newUpwardMessages: UpwardMessage[] = [];

  newBlock.number = block.block.header.number.toBigInt() || BigInt(0);
  newBlock.timestamp = block.timestamp;
  newBlock.parentHash = block.block.header.parentHash.toString();
  newBlock.specVersion = block.specVersion;

  // Process all calls in block
  const wExtrinsics = wrapExtrinsics(block);

  let startEvtIdx = 0;
  const extrinsicWraps = wExtrinsics.map((ext, idx) => {
    const wraps = handleExtrinsic(block, ext, idx, startEvtIdx);
    startEvtIdx += ext.events.length;
    return wraps;
  });

  const newExtrinsics = extrinsicWraps.map(({ newExtrinsic }) => newExtrinsic);
  const newCalls: Call[] = extrinsicWraps.reduce((cs, { newCalls }) => [...cs, ...newCalls], []);
  const newEvents: Event[] = extrinsicWraps.reduce((es, { newEvents }) => [...es, ...newEvents], []);
  const newSystemTokenTransfers: SystemTokenTransfer[] = extrinsicWraps.reduce((ss, { newSystemTokenTransfers }) => [...ss, ...newSystemTokenTransfers], []);
  const newNearToAppchainTransfers: NearToAppchainTransfer[] = extrinsicWraps.reduce((ss, { newNearToAppchainTransfers }) => [...ss, ...newNearToAppchainTransfers], []);

  const accountIdMap = extrinsicWraps.reduce((am, { accountIdMap }) => {
    Object.keys(accountIdMap).forEach((key) => {
      am[key] = am[key] || accountIdMap[key];
    });
    return am;
  }, {});

  await newBlock.save();

  const newAccounts: Account[] = [];
  await Promise.all(Object.keys(accountIdMap).map(async accountId => {
    const existedAccount = await Account.get(accountId);
    if (existedAccount) {
      await tryUpdateAccount(existedAccount, newBlock);
    } else {
      const handledAccount: Account = await handleAccount({ accountId, block: newBlock, creatorId: accountIdMap[accountId] });
      newAccounts.push(handledAccount);
    }
  }));

  await store.bulkCreate("Account", newAccounts);
  await store.bulkCreate("Extrinsic", newExtrinsics);
  await store.bulkCreate("Call", newCalls);
  await store.bulkCreate("Event", newEvents);
  await Promise.all(newSystemTokenTransfers.map(async (data) => await data.save()))

  if (block.block.header.number.toBigInt() >= config.bridgeMessageStartAt.blockNumber) {
    await Promise.all(block.events.map(async (evt, idx) => {
      if (evt.event.section === "octopusUpwardMessages" && evt.event.method === "Committed") {
        newUpwardMessages.push(...handleUpwardMessages(block, evt));
      }
      if (isEraEvent(evt.event) || isBridgeTransferEventOld(evt.event) || isBridgeTransferEvent(evt.event)) {
        await storeBridgeMessageEvent(block, wExtrinsics, evt);
      }
    }));
    await Promise.all(newUpwardMessages.map(async (data) => await data.save()))
  }

  await Promise.all(newNearToAppchainTransfers.map(async (data) => await data.save()))
}