# Python 백엔드 → TypeScript(Node gRPC) + Next.js 전환 — 수정 범위 문서

## 1. 요약

| 구분 | 내용 |
|------|------|
| **유지** | `server.proto` 계약(서비스·메시지 이름), gRPC-Web + Envoy 기반 브라우저 통신 개념 |
| **교체** | Python gRPC 서버 → **Node.js + TypeScript + `@grpc/grpc-js`** (별도 프로세스 권장) |
| **프론트** | CRA `client/` → **Next.js `apps/web/`**(또는 동일 역할 디렉터리)로 이전 시 빌드·환경·라우팅 수정 |
| **반드시 정리** | Envoy 업스트림 포트, 브라우저의 `MessageServiceClient` / `UserServiceClient` **base URL**, proto 코드 생성 파이프라인 |

---

## 2. 백엔드 (현재 `server/` Python)

### 2.1 삭제 또는 레거시 처리 대상

| 경로 | 비고 |
|------|------|
| `server/server.py` | 진입점 — Node TS 서버로 대체 |
| `server/services/*.py` | `UserService`, `MessageService` 로직 이식 |
| `server/proto/server_pb2.py`, `server_pb2_grpc.py` | Python 전용 생성물 — TS용 생성으로 교체 |

### 2.2 신규 추가 (예상)

| 항목 | 설명 |
|------|------|
| `package.json` / `tsconfig.json` | grpc-server 패키지용 |
| 의존성 | `@grpc/grpc-js`, `@grpc/proto-loader` 또는 `grpc-tools` + 생성 스크립트 |
| `src/index.ts` (또는 유사) | `grpc.Server` 생성, 서비스 등록, `bindAsync`로 포트 리슨 |
| `src/services/user.ts`, `message.ts` | `server.proto`의 Servicer 인터페이스 구현 |

### 2.3 구현 시 주의 (기존 Python 동작 기준)

- **Login 응답**: `Join.jsx`는 `response.getStatus() === 'success'`일 때만 `/chat`으로 이동한다. Python은 `"User logged in"`을 반환해 **프론트와 불일치**한다. TS 이전 시 **proto 변경 없이** 상태 문자열을 맞추거나, proto에 `code` 필드를 추가하는 등 **계약 정리**가 필요하다.
- **스트리밍**: 현재 `StreamMessages` / `NotifyUserJoin` / `NotifyUserLeave`는 “이미 쌓인 배열을 한 번 흘려보내는” 수준이다. 동일 동작을 옮기면 학습용으로는 단순하나, “실시간 채팅” 체감을 위해서는 **이벤트 브로드캐스트** 설계가 별도 과제다.

---

## 3. 프로토콜 버퍼 및 코드 생성

### 3.1 단일 소스

- **`server.proto`의 위치**: 루트 `proto/server.proto` 등 **한 곳**으로 모으는 것을 권장한다.
- **서버(Node)**: `.proto` → JS/TS 스텁(`grpc_tools_node_protoc` 등) 또는 런타임 로딩.

### 3.2 클라이언트(브라우저)

- Next.js 앱에서 기존처럼 **grpc-web**을 쓸 경우, `protoc` + `protoc-gen-grpc-web`으로 `*_grpc_web_pb.js`, `*_pb.js` 생성.
- 생성물은 `apps/web/src/gen/` 등으로 두고, import 경로를 전부 수정한다.

---

## 4. 프론트 (현재 `client/` React CRA)

### 4.1 프레임워크 전환 시 수정 대상

| 영역 | 파일(현재) | 작업 |
|------|------------|------|
| 진입·라우팅 | `src/index.js`, `App.jsx`, `Join.jsx`의 `useNavigate` | Next.js `app/` 또는 `pages/` 라우터로 이전; `Join`은 입장 페이지 라우트로 분리 |
| gRPC 클라이언트 | `Join.jsx`, `ChatRoom.jsx` 내 `UserServiceClient` / `MessageServiceClient` | **클라이언트 컴포넌트**(`"use client"`)에서만 사용; base URL은 `process.env.NEXT_PUBLIC_GRPC_WEB_URL` 등 |
| 생성된 pb | `server_pb.js`, `server_grpc_web_pb.js` | 빌드 스크립트로 재생성 후 경로 정리 |
| 상태 | `store/store.js` (zustand) | 그대로 이식 가능하나 Next.js에 맞게 provider 배치 검토 |
| 스타일 | Tailwind, `App.css` | Next.js에 Tailwind 설정 이전 |

### 4.2 CRA 전용 제거

- `react-scripts`, `public/index.html` 단일 진입 구조 → Next.js 규약으로 대체.

---

## 5. Envoy (`envoy/`)

| 항목 | 현재 관찰 | 조치 |
|------|-----------|------|
| 업스트림 포트 | `envoy.yaml`은 `127.0.0.1:9090` | 실제 gRPC 서버 리슨 포트와 **일치**시킨다. |
| 브라우저 | `ChatRoom.jsx` 등은 `http://localhost:50051` | 브라우저는 **gRPC 직접 포트가 아니라 Envoy(또는 게이트웨이) URL**을 쓰는 것이 일반적이다. |
| CORS | 이미 `cors` 필터 존재 | Next.js dev origin(`localhost:3000`)이 허용되는지 확인 |

---

## 6. 문서·도구·기타

| 항목 | 작업 |
|------|------|
| `server/README.md` | Python 전용 설명 → Node/TS 기동·proto 생성 명령으로 갱신 |
| 루트 `README.md` (없으면 추가 여부 팀 합의) | 한 번에 띄우는 순서와 포트 표 |
| `.gitignore` | `node_modules`, Next `.next`, 생성된 pb 대량 파일 정책 |
| Docker (선택) | Envoy + grpc-server + web를 `docker-compose`로 묶으면 재현성 향상 |

---

## 7. 권장 작업 순서

1. **포트·URL 표준화** — Envoy ↔ gRPC 서버 ↔ `NEXT_PUBLIC_*` 한 장짜리 표로 고정  
2. **proto 단일화 + Node TS gRPC 서버 스켈레톤** — Unary(Login 등)부터 동작 확인  
3. **Envoy 경유 gRPC-Web** — 브라우저에서 Unary 성공  
4. **스트리밍 RPC** — `StreamMessages` 등 기존 동작 이식 후 개선(브로드캐스트)은 별도 이슈  
5. **Next.js로 UI 이전** — 라우팅·환경 변수·클라이언트 컴포넌트 분리  
6. **Python `server/` 제거 또는 `legacy/` 이동** — 혼동 방지  

---

## 8. 체크리스트 (완료 기준)

- [ ] `UserService` / `MessageService` 모든 RPC가 Node TS에서 구현됨  
- [ ] 브라우저(Next.js)에서 Envoy(또는 동일 역할 프록시)를 통해 Unary·스트림이 기대대로 동작  
- [ ] Login 등 **문자열 status**가 프론트 조건과 일치(또는 proto 확장으로 명확화)  
- [ ] README에 로컬 실행 방법과 포트가 문서와 실제 코드가 일치  
- [ ] (선택) 기존 CRA `client/` 제거 또는 아카이브  

이 문서는 구현 착수 전 **범위 합의**용이며, 세부 파일 경로는 모노레포 구조를 확정한 뒤 한 번 더 갱신하면 된다.

---

## 9. 구현 반영 현황 (2026-04)

| 항목 | 상태 |
|------|------|
| 공통 proto | `proto/server.proto` 추가 |
| Node TS gRPC 서버 | `packages/grpc-server` (`npm run grpc:dev`) |
| Next.js 웹 | `apps/web` (`npm run web:dev`), gRPC 스텁은 `apps/web/src/gen/` (CRA에서 복사) |
| Envoy 업스트림 | `envoy/envoy.yaml` → `127.0.0.1:50051` |
| 루트 워크스페이스 | `package.json` workspaces + 루트 `README.md` 실행 안내 |

남은 선택 작업: 레거시 `server/`·`client/` 정리, Docker/Compose로 Envoy·서버 일괄 기동, proto 재생성 스크립트를 `proto/` 기준으로 통일.
