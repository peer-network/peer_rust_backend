/* eslint-disable */
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  JSON: { input: any; output: any; }
};

export type AuthPayload = {
  __typename?: 'AuthPayload';
  ResponseCode?: Maybe<Scalars['String']['output']>;
  accessToken?: Maybe<Scalars['String']['output']>;
  refreshToken?: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
};

export type HelloResponse = {
  __typename?: 'HelloResponse';
  currentUserId?: Maybe<Scalars['ID']['output']>;
  currentVersion?: Maybe<Scalars['String']['output']>;
  wikiLink?: Maybe<Scalars['String']['output']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  contactus: StandardResponse;
  login: AuthPayload;
  refreshToken: AuthPayload;
  register: RegisterResponse;
  verifiedAccount: VerifiedAccount;
};


export type MutationContactusArgs = {
  eMail: Scalars['String']['input'];
  message: Scalars['String']['input'];
  name: Scalars['String']['input'];
};


export type MutationLoginArgs = {
  eMail: Scalars['String']['input'];
  password: Scalars['String']['input'];
};


export type MutationRefreshTokenArgs = {
  refreshToken: Scalars['String']['input'];
};


export type MutationRegisterArgs = {
  input: RegisterInput;
};


export type MutationVerifiedAccountArgs = {
  userid: Scalars['ID']['input'];
};

export type Query = {
  __typename?: 'Query';
  hello?: Maybe<HelloResponse>;
};

export type RegisterInput = {
  eMail: Scalars['String']['input'];
  password: Scalars['String']['input'];
  pkey?: InputMaybe<Scalars['String']['input']>;
  username: Scalars['String']['input'];
};

export type RegisterResponse = {
  __typename?: 'RegisterResponse';
  ResponseCode?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  userid?: Maybe<Scalars['ID']['output']>;
};

export type StandardResponse = {
  __typename?: 'StandardResponse';
  ResponseCode?: Maybe<Scalars['String']['output']>;
  data?: Maybe<Scalars['JSON']['output']>;
  status: Scalars['String']['output'];
};

export type VerifiedAccount = {
  __typename?: 'verifiedAccount';
  ResponseCode?: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
};
