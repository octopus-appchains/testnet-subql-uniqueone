import { SubstrateExtrinsic, SubstrateBlock } from "@subql/types";
import { Balance } from '@polkadot/types/interfaces'
import type { CallBase, AnyTuple } from '@polkadot/types/types'
import { Extrinsic, EventRecord, SignedBlock } from '@polkadot/types/interfaces';

export type AnyCall = CallBase<AnyTuple>

// Type construct is not correct
export type AccountType = {
  nonce: number
  consumers: number
  providers: number
  sufficients: number
  data: {
    free: Balance
    reserved: Balance
    miscFrozen: Balance
    feeFrozen: Balance
  }
}


export interface WrappedExtrinsic {
  idx: number;
  extrinsic: Extrinsic;
  block: SubstrateBlock;
  events: EventRecord[];
  success: boolean;
}

export type AccountIdMap = { [key: string]: null | string }
