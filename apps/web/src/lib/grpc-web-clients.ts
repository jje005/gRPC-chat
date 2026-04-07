'use client';

import { MessageServiceClient, UserServiceClient } from '@/gen/server_grpc_web_pb';

/**
 * `NEXT_PUBLIC_GRPC_WEB_URL` 이 있으면 직접 Envoy 등으로 요청(교차 출처·CORS 필요).
 * 없으면 같은 출처 `/grpc-web` → Next rewrites 가 Envoy 로 넘김(로컬 개발 시 CORS 없음).
 */
export function getGrpcWebBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_GRPC_WEB_URL;
  if (fromEnv?.length) {
    return fromEnv;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/grpc-web`;
  }
  return 'http://127.0.0.1:8080';
}

type UserClient = InstanceType<typeof UserServiceClient>;
type MsgClient = InstanceType<typeof MessageServiceClient>;

let userClient: UserClient | null = null;
let messageClient: MsgClient | null = null;

export function getUserServiceClient(): UserClient {
  if (!userClient) {
    // grpc-gen ambient 클래스와 codegen 인스턴스 타입이 어긋남
    userClient = new UserServiceClient(getGrpcWebBaseUrl(), null, null) as UserClient;
  }
  return userClient;
}

export function getMessageServiceClient(): MsgClient {
  if (!messageClient) {
    messageClient = new MessageServiceClient(getGrpcWebBaseUrl(), null, null) as MsgClient;
  }
  return messageClient;
}
