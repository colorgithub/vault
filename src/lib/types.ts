export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Memo {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TotpAccount {
  id: string;
  issuer: string;
  accountName: string;
  secret: string;
  algorithm: string;
  digits: number;
  period: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiErrorShape {
  error?: string;
}
