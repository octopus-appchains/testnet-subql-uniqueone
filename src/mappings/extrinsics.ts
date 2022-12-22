import { SubstrateExtrinsic, SubstrateBlock } from "@subql/types";
import { WrappedExtrinsic, AccountIdMap } from "./types";
import { GenericExtrinsic } from '@polkadot/types/extrinsic';
import { EventRecord } from "@polkadot/types/interfaces";
import {
  Event,
  Extrinsic,
  Call,
  SystemTokenTransfer,
  UpwardMessage,
  AppchainToNearTransfer,
  NearToAppchainTransfer
} from "../types";
import { handleCalls } from './calls';
import { handleSystemTokenTransfer } from './systemTokenTransfer';
import { handleAppchainToNearTransfer, handleNearToAppchainTransfer } from './bridgeEvents';
import { handleEvent } from './event';
import _ from "lodash";

export function wrapExtrinsics(wrappedBlock: SubstrateBlock): WrappedExtrinsic[] {
  return wrappedBlock.block.extrinsics.map((extrinsic, idx) => {
    const events = wrappedBlock.events.filter(
      ({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eqn(idx)
    );
    return {
      idx,
      extrinsic,
      block: wrappedBlock,
      events,
      success:
        events.findIndex((evt) => evt.event.method === "ExtrinsicSuccess") > -1,
    };
  });
}

export function handleExtrinsic(
  block: SubstrateBlock,
  extrinsic: WrappedExtrinsic,
  idx: number,
  startEvtIdx: number,
): {
  newExtrinsic: Extrinsic,
  newCalls: Call[],
  newEvents: Event[],
  newSystemTokenTransfers: SystemTokenTransfer[],
  newAppchainToNearTransfers: AppchainToNearTransfer[],
  newNearToAppchainTransfers: NearToAppchainTransfer[],
  accountIdMap: AccountIdMap
} {
  const extrinsicId = `${block.block.header.number}-${idx}`;
  const newExtrinsic = new Extrinsic(extrinsicId);
  newExtrinsic.hash = extrinsic.extrinsic.hash.toString();
  newExtrinsic.method = extrinsic.extrinsic.method.method;
  newExtrinsic.section = extrinsic.extrinsic.method.section;
  newExtrinsic.args = extrinsic.extrinsic.args?.toString();
  newExtrinsic.signerId = extrinsic.extrinsic.signer?.toString();
  newExtrinsic.nonce = BigInt(extrinsic.extrinsic.nonce.toString()) || BigInt(0);
  newExtrinsic.timestamp = block.timestamp;
  newExtrinsic.signature = extrinsic.extrinsic.signature.toString();
  newExtrinsic.tip = BigInt(extrinsic.extrinsic.tip.toString()) || BigInt(0);
  newExtrinsic.isSigned = extrinsic.extrinsic.isSigned;
  newExtrinsic.isSuccess = extrinsic.success;
  newExtrinsic.blockId = block.block.header.hash.toString();

  const newCalls = handleCalls(newExtrinsic, extrinsic);

  const newEvents = [];
  const newSystemTokenTransfers = [];
  const newAppchainToNearTransfers = [];
  const newNearToAppchainTransfers = [];
  extrinsic.events
    .forEach((evt, idx) => {
      newEvents.push(handleEvent(block, extrinsic, evt, extrinsicId, startEvtIdx + idx));
      if (evt.event.section === "balances" && evt.event.method === "Transfer") {
        newSystemTokenTransfers.push(handleSystemTokenTransfer(block, extrinsic, evt, extrinsicId, startEvtIdx + idx));
      }
      if (evt.event.section === "octopusBridge") {
        if (["Locked", "Nep141Burned", "NonfungibleLocked"].includes(evt.event.method)) {
          newAppchainToNearTransfers.push(handleAppchainToNearTransfer(block, extrinsic, evt, extrinsicId, startEvtIdx + idx))
        }
        if (["Unlocked", "Nep141Minted", "NonfungibleUnlocked"].includes(evt.event.method)) {
          newNearToAppchainTransfers.push(handleNearToAppchainTransfer(block, extrinsic, evt, extrinsicId, startEvtIdx + idx))
        }
      }
    });

  const accountIdMap: AccountIdMap = {};
  accountIdMap[newExtrinsic.signerId] = null;

  newSystemTokenTransfers.forEach(t => {
    accountIdMap[t.fromId] = null;
    accountIdMap[t.toId] = null;
  });

  newAppchainToNearTransfers.forEach(t => {
    accountIdMap[t.senderId] = null;

  });

  newNearToAppchainTransfers.forEach(t => {
    accountIdMap[t.receiverId] = null;
  });

  return {
    newExtrinsic,
    newCalls,
    newEvents,
    newSystemTokenTransfers,
    newAppchainToNearTransfers,
    newNearToAppchainTransfers,
    accountIdMap
  };
}