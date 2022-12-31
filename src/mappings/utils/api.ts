import { AccountType } from '../types';

export async function getAccount(address: string): Promise<AccountType> {
  const account: unknown = await api.query.system.account(address);
  return account as AccountType
}
