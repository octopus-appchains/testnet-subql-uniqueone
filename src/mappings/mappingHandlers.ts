import type { Vec, u32 } from '@polkadot/types'
import { EventRecord, DispatchError } from "@polkadot/types/interfaces";
import { AccountId, Balance } from '@polkadot/types/interfaces/runtime';
import { SubstrateExtrinsic, SubstrateBlock } from "@subql/types";
import { Block, Event, Extrinsic, Call, Account, SystemTokenTransfer, UpwardMessage, AppchainToNearTransfer, NearToAppchainTransfer } from "../types";
import { AnyCall } from './types'
import { IEvent } from '@polkadot/types/types'
import { handleExtrinsic, wrapExtrinsics } from './extrinsics';
import { tryUpdateAccount, handleAccount } from './accounts';
import _ from "lodash";
import { WrappedExtrinsic } from "./types";
import { handleUpwardMessages } from './bridgeMessages';
import { handleAppchainToNearTransfer, handleNearToAppchainTransfer } from './bridgeEvents';

export async function handleBlock(block: SubstrateBlock): Promise<void> {
  const newBlock = new Block(block.block.header.hash.toString())
  const newUpwardMessages: UpwardMessage[] = [];
  block.events.forEach((evt, idx) => {
    if (evt.event.section === "octopusUpwardMessages" && evt.event.method === "Committed") {
      newUpwardMessages.push(...handleUpwardMessages(block, evt));
    }
  });

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
  const newAppchainToNearTransfers: AppchainToNearTransfer[] = extrinsicWraps.reduce((ss, { newAppchainToNearTransfers }) => [...ss, ...newAppchainToNearTransfers], []);
  const newNearToAppchainTransfers: NearToAppchainTransfer[] = extrinsicWraps.reduce((ss, { newNearToAppchainTransfers }) => [...ss, ...newNearToAppchainTransfers], []);

  await newBlock.save();
  const accountIdMap = extrinsicWraps.reduce((am, { accountIdMap }) => {
    Object.keys(accountIdMap).forEach((key) => {
      am[key] = am[key] || accountIdMap[key];
    });
    return am;
  }, {});

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
  await store.bulkCreate("SystemTokenTransfer", newSystemTokenTransfers);
  await store.bulkCreate("UpwardMessage", newUpwardMessages);
  await store.bulkCreate("AppchainToNearTransfer", newAppchainToNearTransfers);
  await store.bulkCreate("NearToAppchainTransfer", newNearToAppchainTransfers);
}

function handleEvent(
  block: SubstrateBlock,
  extrinsic: WrappedExtrinsic,
  event: EventRecord,
  extrinsicId: string,
  idx: number,
): Event {
  const newEvent = new Event(`${block.block.header.number}-${idx}`);
  newEvent.index = Number(event.event.index);
  newEvent.section = event.event.section;
  newEvent.method = event.event.method;
  newEvent.data = JSON.stringify(event.event.data.toHuman());

  newEvent.blockId = block.block.header.hash.toString();
  newEvent.extrinsicId = extrinsicId;

  return newEvent;
}

function handleSystemTokenTransfer(
  block: SubstrateBlock,
  extrinsic: SubstrateExtrinsic,
  event: EventRecord,
  extrinsicId: string,
  idx: number,
): SystemTokenTransfer {
  const { event: { data: [from_origin, to_origin, amount_origin] } } = event;
  const from = (from_origin as AccountId).toString();
  const to = (to_origin as AccountId).toString();
  const amount = (amount_origin as Balance).toBigInt();

  let newSystemTokenTransfer = new SystemTokenTransfer(`${block.block.header.number.toString()}-${idx}`);
  newSystemTokenTransfer.fromId = from;
  newSystemTokenTransfer.toId = to;
  newSystemTokenTransfer.amount = amount;
  newSystemTokenTransfer.timestamp = block.timestamp;
  newSystemTokenTransfer.extrinsicId = extrinsicId;

  return newSystemTokenTransfer;
}