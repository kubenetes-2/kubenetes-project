# Kubernetes 클러스터 트래픽 흐름 분석

## 📋 환경 구성

### 인프라 구성
- **HAProxy**: 192.168.0.204 (외부 IP), 192.168.56.112 (클러스터 IP)
  - 외부 NIC (Bridge): 192.168.0.204 (외부 접근용)
  - 클러스터 NIC (Host-Only): 192.168.56.112 (내부 통신용)
  - Kubernetes API 로드밸런서: `lb-apiserver.kubernetes.local` → 192.168.56.112
- **마스터 노드**: 192.168.0.201-203 (외부 IP), 192.168.56.101-103 (클러스터 IP)
- **워커 노드**: 192.168.56.104-108 (클러스터 IP만)
- **외부 etcd**: 192.168.56.109-111 (클러스터 IP만)

### /etc/hosts 설정
모든 서버에 동일한 /etc/hosts 파일 설정 권장:
```
127.0.0.1 localhost
127.0.1.1 <호스트명>
192.168.56.101 master1
192.168.56.102 master2
192.168.56.103 master3
192.168.56.104 node1
192.168.56.105 node2
192.168.56.106 node3
192.168.56.107 node4
192.168.56.108 node5
192.168.56.109 etcd1
192.168.56.110 etcd2
192.168.56.111 etcd3
192.168.56.112 haproxy
192.168.56.112 lb-apiserver.kubernetes.local
```

**참고**: 
- `/etc/hosts`는 클러스터 내부 통신용 호스트명 매핑
- 외부 접근은 직접 IP 주소 사용 (192.168.0.204)
- 자세한 내용은 `haproxy/HOSTS_CHECK.md` 참고

### 애플리케이션 구성
- **Frontend**: NodePort 30300, 5 replicas (워커 노드에 실행)
- **Backend**: NodePort 30080, 5 replicas (워커 노드에 실행)
- **MongoDB**: ClusterIP, 내부 전용(Active - Standby)
- **CNI**: Cilium (eBPF 기반)

---

## 🎯 HAProxy 용도 및 시나리오

### HAProxy의 역할

HAProxy는 **외부에서 들어오는 모든 요청을 여러 노드에 분산**시킵니다.

#### 1. 웹 브라우저 접속 (포트 80)
- **용도**: 사용자가 웹 브라우저로 웹사이트 접속
- **외부 접속**: `http://192.168.0.204:80` (외부 IP)
- **내부 접속**: `http://192.168.56.112:80` (클러스터 IP)
- **경로**: HAProxy → Frontend → Backend API (자동) → DB
- **예시**: 사용자가 웹사이트에 접속해서 게시글 작성 → Frontend가 Backend API를 호출 → Backend가 DB에 저장

#### 2. API 직접 호출 (포트 8080)
- **용도**: 모바일 앱, 외부 서비스, 직접 API 호출
- **외부 접속**: `http://192.168.0.204:8080/api/...` (외부 IP)
- **내부 접속**: `http://192.168.56.112:8080/api/...` (클러스터 IP)
- **경로**: HAProxy → Backend API → DB
- **예시**: 모바일 앱이 API를 직접 호출해서 데이터 조회/저장

#### 3. Kubernetes API (포트 6443)
- **용도**: Worker 노드가 Control Plane에 접근
- **외부 접속**: `https://192.168.0.204:6443` (외부 IP)
- **내부 접속**: `https://192.168.56.112:6443` (클러스터 IP)
- **경로**: HAProxy → 마스터 노드 → etcd

### ⚠️ 중요한 포인트 1: DB에 데이터를 저장할 때 HAProxy를 거치나요?

**답변**: 
- ❌ **Frontend → Backend → DB 경로**: HAProxy를 거치지 않음 (클러스터 내부 통신)
- ✅ **외부 → Backend API 직접 호출**: HAProxy를 거침 (포트 8080)

```
[시나리오 1: 웹 브라우저 접속]
외부 클라이언트 → HAProxy:80 → Frontend → Backend API (내부 통신) → DB
                                    ↑ HAProxy 거치지 않음

[시나리오 2: API 직접 호출]
외부 클라이언트 → HAProxy:8080 → Backend API → DB
```

### ⚠️ 중요한 포인트 2: Frontend Service도 로드밸런싱을 하는데 HAProxy가 왜 필요한가?

**질문**: Frontend Service(NodePort)도 이미 Pod 간 로드밸런싱을 해주는데 굳이 HAProxy를 두는 이유는?

**답변**: HAProxy는 **외부 진입점**과 **노드 간 로드밸런싱**을 제공합니다.

#### HAProxy 없는 경우 (문제점)

```
외부 클라이언트
    ↓ 직접 노드 IP로 접근해야 함
노드 선택 (예: master1 - 192.168.56.101:30300)
    ↓ 특정 노드에만 집중!
NodePort 30300
    ↓
Frontend Service (로드밸런싱: 5개 Pod)
    ↓
Frontend Pod (5개 중 1개)
```

**문제점**:
- ❌ 외부 클라이언트가 노드 IP를 알아야 함 (`http://192.168.56.101:30300`)
- ❌ 특정 노드에만 트래픽이 집중될 수 있음 (노드 장애 시 접근 불가)
- ❌ 여러 노드 IP를 관리해야 함 (master1-3, node1-5)
- ❌ 노드 장애 시 수동으로 다른 노드 IP로 접근해야 함

#### HAProxy 있는 경우 (해결책)

```
외부 클라이언트
    ↓ 단일 진입점: http://192.168.0.204:80 (외부 IP)
HAProxy (로드밸런싱: 8개 노드)
    ↓ 노드 간 자동 분산 및 장애 복구
선택된 노드 (마스터/워커 중 1개)
    ↓ NodePort 30300
Frontend Service (로드밸런싱: 5개 Pod)
    ↓
Frontend Pod (5개 중 1개)
```

**장점**:
- ✅ **단일 진입점**: 하나의 IP만 외부에 노출 (`http://192.168.0.204:80` - 외부 IP)
- ✅ **노드 간 로드밸런싱**: 8개 노드(마스터 3개 + 워커 5개)에 자동 분산
- ✅ **장애 복구**: 특정 노드 장애 시 자동으로 다른 노드로 전환
- ✅ **헬스체크**: 노드 상태를 주기적으로 확인하여 장애 노드 제외
- ✅ **포트 관리**: 표준 포트(80, 8080) 사용 가능

#### 역할 분담

| 컴포넌트 | 역할 | 범위 |
|---------|------|------|
| **HAProxy** | 노드 간 로드밸런싱 | 8개 노드 (마스터 + 워커) |
| **Frontend Service** | Pod 간 로드밸런싱 | 5개 Frontend Pod |
| **Cilium eBPF** | 실제 Pod 포워딩 | Service → Pod |

**결론**: 
- **HAProxy**: 외부 진입점 + **노드 간** 로드밸런싱 (8개 노드)
- **Frontend Service**: **Pod 간** 로드밸런싱 (5개 Pod)
- 둘은 다른 레벨에서 각각 역할을 수행함

---

## 🔄 전체 트래픽 흐름 요약

### 1. 외부 클라이언트 → Frontend (웹 브라우저 접속)

```
외부 클라이언트
    ↓ http://192.168.0.204:80 (외부 IP) 또는 http://192.168.56.112:80 (클러스터 IP)
HAProxy (로드밸런싱: 8개 노드)
    ↓
선택된 노드 (마스터 또는 워커)
    ↓ NodePort 30300
Cilium eBPF (Service → Pod 변환)
    ↓
Frontend Pod (워커 노드에 실행)
```

### 2. 외부 클라이언트 → Backend API (API 직접 호출)

```
외부 클라이언트 (모바일 앱, 외부 서비스)
    ↓ http://192.168.0.204:8080/api/jobs (외부 IP) 또는 http://192.168.56.112:8080 (클러스터 IP)
HAProxy (로드밸런싱: 8개 노드)
    ↓
선택된 노드 (마스터 또는 워커)
    ↓ NodePort 30080
Cilium eBPF (Service → Pod 변환)
    ↓
Backend Pod (워커 노드에 실행)
    ↓ (자동으로)
MongoDB Pod (DB 저장)
```

**용도**: 모바일 앱이나 외부 서비스가 API를 직접 호출할 때 사용

### 3. Worker 노드 → Kubernetes API Server

```
Worker Node
    ↓ https://192.168.56.112:6443 (클러스터 IP로 내부 접근)
HAProxy (로드밸런싱: 마스터 3개)
    ↓
마스터 노드 (kube-apiserver)
    ↓
External etcd Cluster
```

### 4. 클러스터 내부 통신 (HAProxy 거치지 않음)

**⚠️ 중요**: 이 부분은 HAProxy를 거치지 않습니다!

#### Frontend → Backend → DB 전체 흐름

```
[1단계: 웹 브라우저 접속]
외부 클라이언트
    ↓ http://192.168.0.204:80 (외부 IP로 접속)
HAProxy:80 (로드밸런싱)
    ↓
Frontend Pod

[2단계: Frontend → Backend (클러스터 내부)]
Frontend Pod
    ↓ http://backend:8000 (HAProxy 거치지 않음!)
CoreDNS (Service 이름 → ClusterIP)
    ↓
Cilium eBPF (ClusterIP → Pod IP)
    ↓
Backend Pod

[3단계: Backend → DB (클러스터 내부)]
Backend Pod
    ↓ mongodb://mongodb:27017 (HAProxy 거치지 않음!)
CoreDNS (Service 이름 → ClusterIP)
    ↓
Cilium eBPF (ClusterIP → Pod IP)
    ↓
MongoDB Pod
```

**핵심**: 
- 웹 브라우저 접속만 HAProxy를 거침 (포트 80)
- Frontend → Backend → DB는 모두 클러스터 내부 통신이므로 HAProxy를 거치지 않음
- DB 저장 시 데이터 분산은 Kubernetes Service의 로드밸런싱(eBPF)이 담당

---

## ⚠️ 핵심 개념: 마스터 노드에 Pod가 없을 때

**질문**: HAProxy가 마스터 노드(101-103)로 분배했는데 Pod는 워커 노드에만 있다면?

**답변**: 마스터 노드의 eBPF가 Pod IP를 확인하고 클러스터 네트워크를 통해 워커 노드의 Pod로 포워딩합니다.

```
외부 클라이언트
    ↓
HAProxy → 마스터 노드 선택 (예: master1)
    ↓ NodePort 30300
마스터 노드의 Cilium eBPF
    ↓ Service ClusterIP → Pod IP 변환
    • Pod IP 확인 → 워커 노드에 위치 확인
    ↓ 클러스터 네트워크(CNI)를 통해 워커 노드로 포워딩
워커 노드 (예: node2)
    ↓ Pod IP로 직접 전달
Frontend Pod (워커 노드에 실행 중)
    ↓ 응답
워커 → 마스터 → HAProxy → 외부 클라이언트
```

**핵심**:
- NodePort는 모든 노드(마스터 + 워커)에서 열려있음
- 마스터 노드에도 Cilium eBPF가 설치되어 있어 Service → Pod 변환 가능
- Pod가 다른 노드에 있으면 클러스터 네트워크(CNI)를 통해 해당 노드로 포워딩
- 마스터 노드로 분배되어도 최종적으로 워커 노드의 Pod로 트래픽이 도달

---

## 📊 트래픽 흐름 비교표

| 트래픽 유형 | HAProxy 사용 | 포워딩 경로 | 용도 |
|------------|------------|-----------|------|
| **외부 → Frontend (웹 접속)** | ✅ | HAProxy:80 → NodePort:30300 → eBPF → Pod | 웹 브라우저 접속 |
| **외부 → Backend (API 직접 호출)** | ✅ | HAProxy:8080 → NodePort:30080 → eBPF → Pod | 모바일 앱, 외부 서비스 |
| **Worker → API** | ✅ | HAProxy:6443 → 마스터:6443 → etcd | Kubernetes 제어 |
| **Frontend → Backend** | ❌ | CoreDNS → eBPF → Pod (직접) | 클러스터 내부 통신 |
| **Backend → MongoDB** | ❌ | CoreDNS → eBPF → Pod (직접) | DB 저장/조회 |

### 사용 시나리오별 정리

#### 시나리오 1: 사용자가 웹사이트에 접속해서 게시글 작성
```
사용자 → HAProxy:80 → Frontend → Backend (내부) → DB (내부)
         ↑ HAProxy 분산          ↑ HAProxy 거치지 않음
```

#### 시나리오 2: 모바일 앱이 API를 직접 호출
```
모바일 앱 → HAProxy:8080 → Backend → DB (내부)
           ↑ HAProxy 분산     ↑ HAProxy 거치지 않음
```

---

## 🎯 주요 컴포넌트 역할

| 컴포넌트 | 역할 | 실제 포워딩 |
|---------|------|-----------|
| **HAProxy** | 외부 트래픽 로드밸런싱, Control Plane 접근 | ✅ (외부 → 노드) |
| **Service** | 논리적 엔드포인트 (VIP), Pod 선택 | ❌ (eBPF가 담당) |
| **Cilium eBPF** | Service → Pod 포워딩, 클러스터 내부 통신 | ✅ (모든 내부 포워딩) |
| **CoreDNS** | Service 이름 → ClusterIP 변환 | ❌ (DNS만) |
| **NodePort** | 외부 접근 가능한 Service 포트 | ❌ (트래픽 수신만) |

---

## ✅ 요약

### 포워딩 담당자

1. **Service**: 논리적 엔드포인트만 제공 (VIP), 실제 포워딩은 하지 않음
2. **Cilium eBPF**: 클러스터 내부 모든 트래픽 포워딩 담당 (kube-proxy 대체)
3. **HAProxy**: 외부 트래픽과 Control Plane 접근의 로드밸런서 역할

### 트래픽 흐름 순서

#### 외부 트래픽
```
외부 → HAProxy → NodePort → Cilium eBPF → Pod
```

#### 클러스터 내부 통신
```
Pod → CoreDNS → Cilium eBPF → Pod (HAProxy 거치지 않음)
```

#### Control Plane 통신
```
Worker → HAProxy → kube-apiserver → etcd
```

### 마스터 노드 분배 시

| 시나리오 | HAProxy 분배 | 노드의 eBPF 동작 | 최종 도착지 |
|---------|------------|---------------|-----------|
| **워커 노드로 분배** | node1-5 중 선택 | 워커 노드의 eBPF가 Pod로 포워딩 | 워커 노드의 Pod |
| **마스터 노드로 분배** | master1-3 중 선택 | 마스터 노드의 eBPF가 Pod IP 확인 → 클러스터 네트워크로 워커 노드 포워딩 | 워커 노드의 Pod |

---

## 🔧 HAProxy 설정 방법

### 설정 파일 경로

**HAProxy 설정 파일 위치**: `/etc/haproxy/haproxy.cfg`

### 설정 단계

#### 1. HAProxy 서버에 접속
```bash
ssh root@192.168.0.204
# 또는 클러스터 IP로
ssh root@192.168.56.112
```

#### 2. 설정 파일 복사 또는 생성

**방법 1: 로컬에서 파일 복사**
```bash
# 로컬에서 HAProxy 서버로 파일 복사
scp haproxy/haproxy.cfg root@192.168.0.204:/etc/haproxy/haproxy.cfg
```

**방법 2: HAProxy 서버에서 직접 편집**
```bash
# HAProxy 서버에 접속 후
vi /etc/haproxy/haproxy.cfg
# 또는
nano /etc/haproxy/haproxy.cfg
```

#### 3. 설정 파일 검증
```bash
# HAProxy 서버에서 설정 파일 검증
haproxy -f /etc/haproxy/haproxy.cfg -c
```

**출력 확인**: `Configuration file is valid` 메시지가 나와야 함

#### 4. HAProxy 서비스 재시작
```bash
# HAProxy 재시작
systemctl restart haproxy

# 상태 확인
systemctl status haproxy

# 자동 시작 설정 (선택사항)
systemctl enable haproxy
```

#### 5. 방화벽 포트 허용 (필요 시)
```bash
# 필요한 포트 허용
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=8080/tcp
firewall-cmd --permanent --add-port=8404/tcp
firewall-cmd --permanent --add-port=6443/tcp
firewall-cmd --reload
```

### 주요 포트
- **Kubernetes API**: 6443 → 마스터 노드 3개
- **Frontend**: 80 → 모든 노드 8개 (마스터 3개 + 워커 5개)
- **Backend API**: 8080 → 모든 노드 8개
- **HAProxy Stats**: 8404

### 설정 파일
- **프로젝트 파일**: `haproxy/haproxy.cfg`
- **HAProxy 서버 경로**: `/etc/haproxy/haproxy.cfg`

### 접속 정보

#### 외부 접속 (외부 IP 사용) ⭐
- Frontend: `http://192.168.0.204:80` - 시연 시 사용
- Backend API: `http://192.168.0.204:8080` - 시연 시 사용
- HAProxy Stats: `http://192.168.0.204:8404/stats` - 모니터링

#### 내부 접속 (클러스터 IP 사용)
- Frontend: `http://192.168.56.112:80`
- Backend API: `http://192.168.56.112:8080`
- HAProxy Stats: `http://192.168.56.112:8404/stats`

### 설정 확인 및 테스트

#### 1. HAProxy 상태 확인
```bash
systemctl status haproxy
```

#### 2. 포트 리스닝 확인
```bash
netstat -tlnp | grep haproxy
# 또는
ss -tlnp | grep haproxy
```

#### 3. 웹 접속 테스트
```bash
# 외부에서 접속 테스트
curl http://192.168.0.204:80
curl http://192.168.0.204:8080/api/health
curl http://192.168.0.204:8404/stats
```

### 트러블슈팅

#### HAProxy 시작 실패
```bash
# 로그 확인
journalctl -u haproxy -n 50
# 또는
tail -f /var/log/haproxy.log
```

#### 포트가 열리지 않음
```bash
# 방화벽 확인
firewall-cmd --list-ports

# SELinux 확인 (필요 시)
getenforce
```

---

**결론**: 
- **HAProxy**는 외부 트래픽의 로드밸런서 역할을 함
  - 포트 80: 웹 브라우저 접속 분산 (Frontend)
  - 포트 8080: API 직접 호출 분산 (Backend)
  - 포트 6443: Kubernetes API 접근 분산
- **Cilium eBPF**가 실제 Pod 간 포워딩을 담당함
  - Frontend → Backend → DB는 클러스터 내부 통신 (HAProxy 거치지 않음)
  - DB에 데이터 저장 시에는 Kubernetes Service의 로드밸런싱(eBPF)이 담당
- **Service**는 논리적 엔드포인트만 제공함
- 마스터 노드로 분배되어도 클러스터 네트워크를 통해 워커 노드의 Pod로 포워딩됨

### 💡 요약

**HAProxy는 언제 사용하나요?**
1. ✅ **웹 브라우저 접속**: `http://192.168.0.204:80` (외부 IP) → Frontend로 분산
2. ✅ **API 직접 호출**: `http://192.168.0.204:8080` (외부 IP) → Backend API로 분산
3. ✅ **Kubernetes API**: `https://192.168.56.112:6443` (클러스터 IP) → 마스터 노드로 분산

**HAProxy를 거치지 않는 경우**
1. ❌ **Frontend → Backend**: 클러스터 내부 통신
2. ❌ **Backend → DB**: 클러스터 내부 통신
3. ❌ **Pod 간 통신**: 모두 클러스터 내부 통신

**DB 저장 시 분산은 어떻게 하나요?**
- HAProxy가 아니라 **Kubernetes Service + Cilium eBPF**가 담당
- Backend Pod가 여러 개(5개)이므로, Service의 로드밸런싱(eBPF)에 의해 분산됨
- 각 Backend Pod는 MongoDB에 연결하여 데이터 저장
