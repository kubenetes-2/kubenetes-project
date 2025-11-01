# Kubernetes 클러스터 트래픽 흐름 분석

## 📋 환경 구성

### 인프라 구성
- **HAProxy**: 192.168.0.204 (외부 IP), 192.168.56.112 (클러스터 IP)
- **마스터 노드**: 192.168.0.201-203 (외부 IP), 192.168.56.101-103 (클러스터 IP)
- **워커 노드**: 192.168.56.104-108 (클러스터 IP)
- **외부 etcd**: 192.168.56.109-111

### 애플리케이션 구성
- **Frontend**: NodePort 30300, 5 replicas (워커 노드)
- **Backend**: NodePort 30080, 3 replicas (워커 노드)
- **MongoDB**: ClusterIP, 2 replicas (내부 전용, Replica Set)
- **CNI**: Cilium (eBPF 기반)

**현재 노드 상태**:
- **정상 노드**: node1, node2, node4, node5 (HAProxy에서 사용)
- **문제 노드**: node3 (NotReady, HAProxy에서 제외)

---

## 🚀 전체 트래픽 플로우 요약

### 1. 외부 웹 접속 플로우 (사용자 → 웹사이트)

```
[단계 1: 웹 브라우저 접속]
사용자 브라우저
    ↓ http://192.168.0.204:80
HAProxy (로드밸런싱: node1, node2, node4, node5)
    ↓ NodePort 30300
Cilium eBPF (Service → Pod 변환)
    ↓
Frontend Pod (5개 중 1개)

[단계 2: Frontend → Backend (클러스터 내부)]
Frontend Pod
    ↓ http://backend:8000
CoreDNS → Cilium eBPF
    ↓
Backend Pod (3개 중 1개)

[단계 3: Backend → MongoDB (클러스터 내부)]
Backend Pod
    ↓ mongodb://mongodb:27017
CoreDNS → Cilium eBPF
    ↓
MongoDB Pod (2개 중 1개)
```

### 2. 외부 API 직접 호출 플로우

```
외부 클라이언트 (모바일 앱, 외부 서비스)
    ↓ http://192.168.0.204:8080/api/jobs
HAProxy (로드밸런싱: node1, node2, node4, node5)
    ↓ NodePort 30080
Cilium eBPF (Service → Pod 변환)
    ↓
Backend Pod (3개 중 1개)
    ↓
MongoDB Pod (DB 저장/조회)
```

### 3. Worker → Kubernetes API Server

```
Worker Node
    ↓ https://192.168.56.112:6443
HAProxy (로드밸런싱: master1, master2, master3)
    ↓
마스터 노드 (kube-apiserver)
    ↓
External etcd Cluster
```

---

## 🎯 컴포넌트별 역할

| 컴포넌트 | 역할 | 범위 |
|---------|------|------|
| **HAProxy** | 외부 진입점, 노드 간 로드밸런싱 | node1,2,4,5 (4개 노드) |
| **Service** | 논리적 엔드포인트 (VIP) | Pod 그룹 |
| **Cilium eBPF** | 실제 포워딩 (Service → Pod) | 클러스터 전체 |
| **CoreDNS** | DNS 해석 (서비스 이름 → IP) | 클러스터 전체 |

---

## ✅ 중요한 구분

### HAProxy를 거치는 경우
- ✅ 외부 클라이언트 → Frontend (포트 80)
- ✅ 외부 클라이언트 → Backend API (포트 8080)
- ✅ Worker 노드 → Kubernetes API (포트 6443)

### HAProxy를 거치지 않는 경우
- ❌ Frontend → Backend (클러스터 내부 통신)
- ❌ Backend → MongoDB (클러스터 내부 통신)
- ❌ 모든 Pod 간 통신

---

## 📊 트래픽 흐름 비교표

| 트래픽 유형 | HAProxy 사용 | 포워딩 경로 |
|------------|------------|-----------|
| **외부 → Frontend** | ✅ | HAProxy:80 → NodePort:30300 → eBPF → Pod |
| **외부 → Backend** | ✅ | HAProxy:8080 → NodePort:30080 → eBPF → Pod |
| **Worker → API** | ✅ | HAProxy:6443 → 마스터:6443 → etcd |
| **Frontend → Backend** | ❌ | CoreDNS → eBPF → Pod (직접) |
| **Backend → MongoDB** | ❌ | CoreDNS → eBPF → Pod (직접) |

---

## 📝 현재 설정 요약

### HAProxy 백엔드
- **Frontend**: node1, node2, node4, node5 (포트 30300)
- **Backend**: node1, node2, node4, node5 (포트 30080)
- **Kubernetes API**: master1, master2, master3 (포트 6443)

### 애플리케이션 Pod
- **Frontend**: 5개 (워커 노드)
- **Backend**: 3개 (워커 노드) - 메모리 부족으로 조정
- **MongoDB**: 2개 (Replica Set)

### 접속 주소
- **외부 웹 접속**: `http://192.168.0.204:80`
- **외부 API 호출**: `http://192.168.0.204:8080`
- **HAProxy 통계**: `http://192.168.0.204:8404/stats`

---

## 🔑 핵심 개념

### 트래픽 플로우 핵심
1. **외부 트래픽**: HAProxy → NodePort → Cilium eBPF → Pod
2. **내부 통신**: Pod → CoreDNS → Cilium eBPF → Pod (HAProxy 거치지 않음)
3. **DB 저장**: Backend Pod → MongoDB (Service 로드밸런싱으로 분산)

### HAProxy의 역할
- **외부 진입점**: 하나의 IP만 외부에 노출 (`http://192.168.0.204:80`)
- **노드 간 로드밸런싱**: 4개 워커 노드에 자동 분산
- **장애 복구**: 특정 노드 장애 시 자동으로 다른 노드로 전환
- **헬스체크**: 노드 상태를 주기적으로 확인하여 장애 노드 제외

### Service와 HAProxy의 차이
- **HAProxy**: 노드 간 로드밸런싱 (4개 노드)
- **Service**: Pod 간 로드밸런싱 (5개 Frontend Pod, 3개 Backend Pod)
- **Cilium eBPF**: 실제 포워딩 담당 (Service → Pod)

### DB 저장 시 분산
- HAProxy가 아니라 **Kubernetes Service + Cilium eBPF**가 담당
- Backend Pod가 여러 개(3개)이므로, Service의 로드밸런싱(eBPF)에 의해 분산됨
- 각 Backend Pod는 MongoDB에 연결하여 데이터 저장

---

**결론**: 
- **외부 트래픽**은 HAProxy를 통해 노드로 분산되고, NodePort와 Cilium eBPF를 거쳐 Pod로 전달됨
- **클러스터 내부 통신**(Frontend → Backend → MongoDB)은 HAProxy를 거치지 않고 CoreDNS와 Cilium eBPF를 통해 직접 통신함
- **DB 저장 시 분산**은 Kubernetes Service의 로드밸런싱(eBPF)이 담당함
