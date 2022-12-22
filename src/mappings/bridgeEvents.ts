import { EventRecord } from "@polkadot/types/interfaces";
import { AccountId, Balance } from '@polkadot/types/interfaces/runtime';
import { SubstrateExtrinsic, SubstrateBlock } from "@subql/types";
import { AppchainToNearTransfer, NearToAppchainTransfer } from "../types";
import _ from "lodash";

export function handleAppchainToNearTransfer(
  block: SubstrateBlock,
  extrinsic: SubstrateExtrinsic,
  event: EventRecord,
  extrinsicId: string,
  idx: number,
): AppchainToNearTransfer {
  const { event: { method, data } } = event;

  const { sequence }: any = data.toHuman();
  let newAppchainToNearTransfer = new AppchainToNearTransfer(sequence.replaceAll('\\', ''));
  if (method === "Locked") {
    const [sender, receiver, amount, fee, sequence] = data;
    newAppchainToNearTransfer.senderId = sender.toString();
    newAppchainToNearTransfer.receiver = receiver.toString();
    newAppchainToNearTransfer.type = method;
    newAppchainToNearTransfer.amount = BigInt(amount.toString());
    newAppchainToNearTransfer.sequence = BigInt(sequence.toString());
  } else if (method === "Nep141Burned") {
    const [assetId, sender, receiver, amount, fee, sequence] = data;
    newAppchainToNearTransfer.senderId = sender.toString();
    newAppchainToNearTransfer.receiver = receiver.toString();
    newAppchainToNearTransfer.type = method;
    newAppchainToNearTransfer.assetId = Number(assetId.toString());
    newAppchainToNearTransfer.amount = BigInt(amount.toString());
    newAppchainToNearTransfer.sequence = BigInt(sequence.toString());
  } else if (method === "NonfungibleLocked") {
    const [collection, item, sender, receiver, fee, sequence] = data;
    newAppchainToNearTransfer.senderId = sender.toString();
    newAppchainToNearTransfer.receiver = receiver.toString();
    newAppchainToNearTransfer.type = method;
    newAppchainToNearTransfer.collection = BigInt(collection.toString());
    newAppchainToNearTransfer.item = BigInt(item.toString());
    newAppchainToNearTransfer.sequence = BigInt(sequence.toString());
  }
  newAppchainToNearTransfer.timestamp = block.timestamp;
  newAppchainToNearTransfer.extrinsicId = extrinsicId;
  return newAppchainToNearTransfer;
}

export function handleNearToAppchainTransfer(
  block: SubstrateBlock,
  extrinsic: SubstrateExtrinsic,
  event: EventRecord,
  extrinsicId: string,
  idx: number,
): NearToAppchainTransfer {
  const { event: { method, data } } = event;

  const { sequence }: any = data.toHuman();
  let newNearToAppchainTransfer = new NearToAppchainTransfer(sequence.replaceAll('\\', ''));
  if (method === "Unlocked") {
    const [sender, receiver, amount, sequence] = data;
    newNearToAppchainTransfer.sender = sender.toString();
    newNearToAppchainTransfer.receiverId = receiver.toString();
    newNearToAppchainTransfer.type = method;
    newNearToAppchainTransfer.amount = BigInt(amount.toString());
    newNearToAppchainTransfer.sequence = BigInt(sequence.toString());
  } else if (method === "Nep141Minted") {
    const [assetId, sender, receiver, amount, sequence] = data;
    newNearToAppchainTransfer.sender = sender.toString();
    newNearToAppchainTransfer.receiverId = receiver.toString();
    newNearToAppchainTransfer.type = method;
    newNearToAppchainTransfer.assetId = Number(assetId.toString());
    newNearToAppchainTransfer.amount = BigInt(amount.toString());
    newNearToAppchainTransfer.sequence = BigInt(sequence.toString());
  } else if (method === "NonfungibleUnlocked") {
    const [collection, item, sender, receiver, sequence] = data;
    newNearToAppchainTransfer.sender = sender.toString();
    newNearToAppchainTransfer.receiverId = receiver.toString();
    newNearToAppchainTransfer.type = method;
    newNearToAppchainTransfer.collection = BigInt(collection.toString());
    newNearToAppchainTransfer.item = BigInt(item.toString());
    newNearToAppchainTransfer.sequence = BigInt(sequence.toString());
  }
  newNearToAppchainTransfer.timestamp = block.timestamp;
  newNearToAppchainTransfer.extrinsicId = extrinsicId;
  return newNearToAppchainTransfer;
}