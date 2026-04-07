# WSL2 / Docker Desktop 없이 개발하기

> **권장 플로우(Envoy는 Docker 안 씀):** 저장소를 **WSL2 Ubuntu 파일 시스템**에 clone 한 뒤, 같은 WSL 안에서 `npm run grpc:dev` + **Envoy Linux 바이너리**로 `envoy -c envoy/envoy.yaml` 만 실행합니다.  
> 이렇게 하면 `127.0.0.1:50051` 그대로 쓰면 되고, Windows 쪽 Docker Desktop은 필요 없습니다.

기업 환경에서 **Docker Desktop 유료**로 막혀 있을 때, 이 프로젝트를 돌리는 **무료** 루트를 정리합니다.

## Git에 Docker 이미지를 넣지 않는 이유

Docker 이미지는 수백 MB 단위라 **Git에 커밋하지 않습니다.**  
대신 저장소에는 **`docker-compose.yml` + `envoy/envoy.docker-host.yaml`** 만 두고, 실행 시 레지스트리에서 이미지를 **pull** 합니다(공개 이미지, 별도 과금 없음).

---

## 방법 A (가장 단순, 추천): WSL2 안에서만 돌리기 — **Docker 없음**

Windows는 **터미널만** 쓰고, **Node + Envoy 바이너리**를 전부 **WSL2 Ubuntu**에 둡니다.

### 1) WSL2 + Ubuntu 설치 (미설치인 경우)

PowerShell(관리자):

```powershell
wsl --install
```

재부팅 후 Ubuntu 실행, 사용자 생성.

### 2) Node.js (WSL)

[nvm](https://github.com/nvm-sh/nvm) 또는 [NodeSource](https://github.com/nodesource/distributions) 등으로 LTS 설치.

### 3) 저장소를 WSL 파일 시스템에 두기 (권장)

`\\wsl$\Ubuntu\home\<user>\projects\...` 처럼 **Linux 쪽 경로**에 clone 하면 I/O가 더 안정적입니다.

### 4) 의존성 & gRPC 서버 (WSL 터미널)

```bash
cd ~/projects/gRPC-chat   # 본인 경로
npm install
npm run grpc:dev
```

### 5) Envoy 바이너리 (WSL, Docker 없이)

[Envoy Releases](https://github.com/envoyproxy/envoy/releases) 에서 **Linux x64**용 `envoy-*-linux_x86_64` 형태의 빌드를 받아 압축 해제 후:

```bash
chmod +x envoy
sudo mv envoy /usr/local/bin/   # 또는 PATH에 걸린 디렉터리
envoy --version
```

**다른 터미널**에서 저장소 루트로 이동 후:

```bash
envoy -c envoy/envoy.yaml
```

이때 gRPC도 **같은 WSL**에서 떠 있으므로 `envoy.yaml` 의 **`127.0.0.1:50051`** 그대로 사용하면 됩니다.

### 6) 웹 (WSL 또는 Windows)

- **WSL에서** `npm run web:dev` → 브라우저(Windows)에서 `http://localhost:3000` 접속.  
  최신 Windows는 WSL 포트를 **localhost로 포워딩** 해 줍니다.

### 7) 프론트 환경 변수

`apps/web/.env.local` 의 `NEXT_PUBLIC_GRPC_WEB_URL` 은 **`http://localhost:8080`** (Envoy).

---

## 방법 B: Docker **Desktop 없이** — WSL2 안에 **Docker Engine**만 설치

Docker Desktop이 아니라, **Ubuntu(WSL) 패키지**로 Docker를 올리는 방식입니다. (조직 정책에 따라 IT 승인이 필요할 수 있음.)

공식 가이드: [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)  
WSL2 Ubuntu에서 `docker.io` 또는 Docker 공식 apt 저장소로 **docker ce + compose plugin** 설치.

설치 후 (저장소 루트, **WSL**):

```bash
# 터미널 1 — 호스트(WSL)에서 gRPC
npm run grpc:dev

# 터미널 2 — Envoy만 컨테이너
docker compose up envoy
```

`docker-compose.yml` 은 **`host.docker.internal` + `host-gateway`** 로 **호스트의 50051** 을 바라봅니다.  
gRPC를 **같은 WSL**에서 띄우면 연결됩니다.

**Podman** 을 쓰는 경우: `podman compose up envoy` (환경에 따라 `extra_hosts` 지원 확인).

---

## 방법 C: Windows에만 Node, WSL에만 Envoy

가능은 하지만 **업스트림 IP**를 `127.0.0.1` 로는 맞추기 어렵고, WSL↔Windows 주소를 수동으로 넣어야 해서 **비추천**입니다.  
가능하면 **방법 A** 처럼 **gRPC와 Envoy를 같은 OS(WSL)에서** 맞추세요.

---

## Docker Desktop 대신 쓸 수 있는 무료 GUI (참고)

- **Rancher Desktop** (개인/소규모 무료 정책은 제품 페이지 확인)  
- **Podman** (CLI 중심, Windows에선 Podman Machine)

조직마다 허용 목록이 다르므로, **IT 정책**을 먼저 확인하는 것이 좋습니다.

---

## 관련 파일

| 파일 | 용도 |
|------|------|
| `envoy/envoy.yaml` | 호스트에서 `envoy -c` 직접 실행 시 (`127.0.0.1:50051`) |
| `envoy/envoy.docker-host.yaml` | `docker compose` 로 컨테이너 실행 시 (`host.docker.internal:50051`) |
| `docker-compose.yml` | Envoy 컨테이너만 정의 (이미지는 pull) |

다른 실행 흐름은 [03_LOCAL_RUN.md](./03_LOCAL_RUN.md), Envoy 개요는 [04_ENVOY_ALTERNATIVES.md](./04_ENVOY_ALTERNATIVES.md) 를 참고하세요.
