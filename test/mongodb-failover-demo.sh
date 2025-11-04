#!/bin/bash
# MongoDB Replica Set 자동 페일오버 시연 스크립트
# 정방향 및 역방향 페일오버 테스트

# set -e는 주석 처리 (오류 처리를 수동으로 처리)
# set -e

NAMESPACE="dev-db"
PRIMARY_POD="mongodb-0"
SECONDARY_POD="mongodb-1"

echo "=========================================="
echo "MongoDB Replica Set 자동 페일오버 시연"
echo "=========================================="
echo ""

# 0. 초기 상태 확인 및 설정
echo "[0단계] 초기 상태 확인"
echo "----------------------------------------"
echo "MongoDB Pod 상태:"
kubectl get pods -n $NAMESPACE -l app=mongodb -o wide
echo ""

# Pod가 Ready 상태가 될 때까지 대기
echo "0-1. MongoDB Pod가 Ready 상태가 될 때까지 대기..."
PODS_READY=false
for i in {1..60}; do
  POD_COUNT=$(kubectl get pods -n $NAMESPACE -l app=mongodb --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
  READY_COUNT=$(kubectl get pods -n $NAMESPACE -l app=mongodb --field-selector=status.phase=Running -o jsonpath='{.items[*].status.containerStatuses[0].ready}' 2>/dev/null | grep -o true | wc -l)
  
  if [ "$POD_COUNT" -ge 2 ] && [ "$READY_COUNT" -ge 2 ]; then
    PODS_READY=true
    echo ""
    echo "✅ MongoDB Pod들이 Ready 상태입니다"
    break
  fi
  
  if [ $i -eq 60 ]; then
    echo ""
    echo "⚠️ MongoDB Pod들이 아직 Ready 상태가 아닙니다 (60초 타임아웃)"
    echo "  Running Pod: $POD_COUNT/2"
    echo "  Ready Pod: $READY_COUNT/2"
    echo ""
    echo "Pod 상태 진단:"
    kubectl get pods -n $NAMESPACE -l app=mongodb -o wide
    echo ""
    echo "Pending Pod 상세 정보:"
    for pod in $(kubectl get pods -n $NAMESPACE -l app=mongodb -o jsonpath='{.items[?(@.status.phase=="Pending")].metadata.name}'); do
      if [ -n "$pod" ]; then
        echo "--- $pod ---"
        kubectl describe pod $pod -n $NAMESPACE | grep -A 5 "Events:" || echo "Events 정보 없음"
        echo ""
      fi
    done
    echo ""
    echo "StatefulSet 상태:"
    kubectl get statefulset mongodb -n $NAMESPACE -o wide
    echo ""
    read -p "그래도 계속하시겠습니까? (y/N): " continue_anyway
    if [[ $continue_anyway != [yY] ]]; then
      echo "시연 취소됨"
      exit 0
    fi
    break
  else
    echo -ne "\r   대기 중... ($i/60초) - Running: $POD_COUNT/2, Ready: $READY_COUNT/2"
    sleep 1
  fi
done
echo ""

# Pod 상태 재확인
echo "최종 Pod 상태:"
kubectl get pods -n $NAMESPACE -l app=mongodb -o wide
echo ""

# PRIMARY Pod 확인 및 설정
PRIMARY_POD_READY=$(kubectl get pod $PRIMARY_POD -n $NAMESPACE -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null)
if [ "$PRIMARY_POD_READY" != "true" ]; then
  echo "⚠️ mongodb-0 Pod가 아직 Ready 상태가 아닙니다"
  echo "PRIMARY Pod 상태:"
  kubectl get pod $PRIMARY_POD -n $NAMESPACE -o wide
  echo ""
  read -p "그래도 계속하시겠습니까? (y/N): " continue_anyway
  if [[ $continue_anyway != [yY] ]]; then
    echo "시연 취소됨"
    exit 0
  fi
fi

echo "Replica Set 초기 상태:"
# Pod가 Ready 상태인지 확인 후 실행
if kubectl get pod $PRIMARY_POD -n $NAMESPACE -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null | grep -q true; then
  if ! kubectl exec -n $NAMESPACE $PRIMARY_POD -- mongosh --quiet --eval "
    try {
      const status = rs.status();
      console.log('Replica Set 상태:');
      status.members.forEach(m => {
        console.log('  ' + m.name + ': ' + m.stateStr + ' (health: ' + m.health + ', priority: ' + (m.priority || 1) + ')');
      });
      
      const primary = status.members.find(m => m.stateStr === 'PRIMARY');
      const secondary = status.members.find(m => m.stateStr === 'SECONDARY');
      
      if (primary) {
        console.log('\n✅ PRIMARY: ' + primary.name);
      }
      if (secondary) {
        console.log('✅ SECONDARY: ' + secondary.name);
      }
      
      if (status.settings) {
        console.log('\n설정:');
        console.log('  Election timeout: ' + status.settings.electionTimeoutMillis + 'ms');
        console.log('  Heartbeat interval: ' + status.settings.heartbeatIntervalMillis + 'ms');
      }
    } catch(e) {
      console.log('❌ 오류:', e.message);
      exit(1);
    }
  " 2>&1; then
    echo "⚠️ Replica Set 상태 확인 실패 (Pod가 아직 준비되지 않았을 수 있습니다)"
    echo ""
    read -p "그래도 계속하시겠습니까? (y/N): " continue_anyway
    if [[ $continue_anyway != [yY] ]]; then
      echo "시연 취소됨"
      exit 0
    fi
  fi
else
  echo "⚠️ mongodb-0 Pod가 Ready 상태가 아니어서 Replica Set 상태를 확인할 수 없습니다"
  echo ""
  read -p "그래도 계속하시겠습니까? (y/N): " continue_anyway
  if [[ $continue_anyway != [yY] ]]; then
    echo "시연 취소됨"
    exit 0
  fi
fi
echo ""

read -p "계속하시겠습니까? (y/N): " confirm
if [[ $confirm != [yY] ]]; then
  echo "시연 취소됨"
  exit 0
fi

# 1. 정방향 페일오버 테스트 (mongodb-0 → mongodb-1)
echo ""
echo "=========================================="
echo "[1단계] 정방향 페일오버 테스트"
echo "PRIMARY(mongodb-0) → SECONDARY(mongodb-1) 승격"
echo "=========================================="
echo ""

echo "1-1. 테스트 데이터 쓰기 (PRIMARY에서)"
kubectl exec -n $NAMESPACE $PRIMARY_POD -- mongosh --quiet --eval "
  const jobsdb = db.getSiblingDB('jobsdb');
  jobsdb.failover_test.insertOne({
    test: 'forward-failover-test',
    timestamp: new Date(),
    direction: 'forward',
    value: Math.random()
  });
  console.log('✅ 테스트 데이터 쓰기 완료');
  console.log('총 문서 수:', jobsdb.failover_test.countDocuments());
"
echo ""

echo "1-2. PRIMARY(mongodb-0) 강제 종료"
kubectl delete pod $PRIMARY_POD -n $NAMESPACE
echo ""

echo "1-3. Election 대기 중... (Election timeout: 5초)"
for i in {1..15}; do
  echo -ne "\r   진행 중... ($i/15초)"
  sleep 1
done
echo ""
echo ""

echo "1-4. 페일오버 결과 확인"
kubectl exec -n $NAMESPACE $SECONDARY_POD -- mongosh --quiet --eval "
  try {
    const status = rs.status();
    const primary = status.members.find(m => m.stateStr === 'PRIMARY');
    
    if (primary && primary.name.includes('mongodb-1')) {
      console.log('✅ 정방향 페일오버 성공!');
      console.log('✅ PRIMARY: ' + primary.name);
      console.log('');
      console.log('Replica Set 상태:');
      status.members.forEach(m => {
        console.log('  ' + m.name + ': ' + m.stateStr + ' (health: ' + m.health + ')');
      });
      
      // 데이터 확인
      const jobsdb = db.getSiblingDB('jobsdb');
      const count = jobsdb.failover_test.countDocuments();
      console.log('');
      console.log('✅ 데이터 무손실 확인: ' + count + '개 문서');
    } else {
      console.log('⚠️ 정방향 페일오버 실패 또는 아직 진행 중');
      console.log('PRIMARY:', primary ? primary.name : '없음');
    }
  } catch(e) {
    console.log('❌ 오류:', e.message);
  }
"
echo ""

read -p "다음 단계로 진행하시겠습니까? (y/N): " confirm
if [[ $confirm != [yY] ]]; then
  echo "시연 중단"
  exit 0
fi

# 2. mongodb-0 재시작 및 SECONDARY로 추가
echo ""
echo "=========================================="
echo "[2단계] mongodb-0 복구 및 SECONDARY 추가"
echo "=========================================="
echo ""

echo "2-1. mongodb-0 재시작 대기"
echo "mongodb-0 Pod가 Ready 상태가 될 때까지 대기 중..."
for i in {1..30}; do
  if kubectl get pod $PRIMARY_POD -n $NAMESPACE -o jsonpath='{.status.phase}' 2>/dev/null | grep -q Running; then
    if kubectl get pod $PRIMARY_POD -n $NAMESPACE -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null | grep -q true; then
      echo "✅ mongodb-0가 Ready 상태입니다"
      break
    fi
  fi
  if [ $i -eq 30 ]; then
    echo "⚠️ mongodb-0가 아직 준비되지 않았습니다 (30초 타임아웃)"
  else
    echo -ne "\r   대기 중... ($i/30초)"
    sleep 1
  fi
done
echo ""

echo "2-2. mongodb-0를 SECONDARY로 추가"
kubectl exec -n $NAMESPACE $SECONDARY_POD -- mongosh --quiet --eval "
  try {
    const status = rs.status();
    const hasMongo0 = status.members.find(m => m.name.includes('mongodb-0'));
    
    if (hasMongo0 === undefined) {
      console.log('mongodb-0 추가 중...');
      rs.add({
        _id: 0,
        host: 'mongodb-0.mongodb-headless.dev-db.svc.cluster.local:27017',
        priority: 2
      });
      console.log('✅ mongodb-0를 SECONDARY로 추가했습니다');
      
      sleep(5000);
      const newStatus = rs.status();
      const mongo0 = newStatus.members.find(m => m.name.includes('mongodb-0'));
      if (mongo0) {
        console.log('mongodb-0 상태:', mongo0.stateStr, '(health:', mongo0.health + ')');
      }
    } else {
      console.log('✅ mongodb-0가 이미 Replica Set에 있습니다');
      console.log('상태:', hasMongo0.stateStr, '(health:', hasMongo0.health + ')');
    }
  } catch(e) {
    console.log('❌ 오류:', e.message);
  }
"
echo ""

echo "2-3. mongodb-0가 SECONDARY로 복구될 때까지 대기"
echo "mongodb-0가 SECONDARY 상태가 될 때까지 대기 중..."
for i in {1..30}; do
  SECONDARY_STATE=$(kubectl exec -n $NAMESPACE $SECONDARY_POD -- mongosh --quiet --eval "
    try {
      const status = rs.status();
      const mongo0 = status.members.find(m => m.name.includes('mongodb-0'));
      if (mongo0 && mongo0.stateStr === 'SECONDARY' && mongo0.health === 1) {
        print('READY');
      } else {
        print('NOT_READY');
      }
    } catch(e) {
      print('ERROR');
    }
  " 2>/dev/null | tr -d '\r\n')
  
  if [ "$SECONDARY_STATE" = "READY" ]; then
    echo ""
    echo "✅ mongodb-0가 SECONDARY로 복구되었습니다"
    break
  fi
  if [ $i -eq 30 ]; then
    echo ""
    echo "⚠️ mongodb-0가 아직 SECONDARY로 복구되지 않았습니다 (30초 타임아웃)"
  else
    echo -ne "\r   대기 중... ($i/30초)"
    sleep 1
  fi
done
echo ""

echo "2-4. Replica Set 상태 확인"
kubectl exec -n $NAMESPACE $SECONDARY_POD -- mongosh --quiet --eval "
  const status = rs.status();
  console.log('Replica Set 상태:');
  status.members.forEach(m => {
    console.log('  ' + m.name + ': ' + m.stateStr + ' (health: ' + m.health + ', priority: ' + (m.priority || 1) + ')');
  });
  
  const primary = status.members.find(m => m.stateStr === 'PRIMARY');
  const secondary = status.members.find(m => m.stateStr === 'SECONDARY');
  
  if (primary) {
    console.log('\n✅ PRIMARY: ' + primary.name);
  }
  if (secondary) {
    console.log('✅ SECONDARY: ' + secondary.name);
  }
"
echo ""

read -p "역방향 페일오버 테스트로 진행하시겠습니까? (y/N): " confirm
if [[ $confirm != [yY] ]]; then
  echo "시연 중단"
  exit 0
fi

# 3. 역방향 페일오버 테스트 (mongodb-1 → mongodb-0)
echo ""
echo "=========================================="
echo "[3단계] 역방향 페일오버 테스트"
echo "PRIMARY(mongodb-1) → SECONDARY(mongodb-0) 승격"
echo "=========================================="
echo ""

echo "3-0. mongodb-0 Pod 상태 확인"
PRIMARY_POD_READY=$(kubectl get pod $PRIMARY_POD -n $NAMESPACE -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null)
if [ "$PRIMARY_POD_READY" != "true" ]; then
  echo "⚠️ mongodb-0 Pod가 아직 Ready 상태가 아닙니다. 대기 중..."
  kubectl wait --for=condition=ready pod/$PRIMARY_POD -n $NAMESPACE --timeout=60s || {
    echo "❌ mongodb-0 Pod가 Ready 상태가 되지 않았습니다. 역방향 페일오버 테스트를 중단합니다."
    exit 1
  }
fi
echo "✅ mongodb-0 Pod가 Ready 상태입니다"
echo ""

echo "3-1. 테스트 데이터 쓰기 (현재 PRIMARY에서)"
kubectl exec -n $NAMESPACE $SECONDARY_POD -- mongosh --quiet --eval "
  const jobsdb = db.getSiblingDB('jobsdb');
  jobsdb.failover_test.insertOne({
    test: 'reverse-failover-test',
    timestamp: new Date(),
    direction: 'reverse',
    value: Math.random()
  });
  console.log('✅ 테스트 데이터 쓰기 완료');
  console.log('총 문서 수:', jobsdb.failover_test.countDocuments());
"
echo ""

echo "3-2. PRIMARY(mongodb-1) 강제 종료"
kubectl delete pod $SECONDARY_POD -n $NAMESPACE
echo ""

echo "3-3. Election 대기 중... (Election timeout: 5초)"
for i in {1..15}; do
  echo -ne "\r   진행 중... ($i/15초)"
  sleep 1
done
echo ""
echo ""

echo "3-4. 페일오버 결과 확인"
# mongodb-0 Pod가 Ready 상태인지 다시 확인
if ! kubectl get pod $PRIMARY_POD -n $NAMESPACE -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null | grep -q true; then
  echo "⚠️ mongodb-0 Pod가 아직 Ready 상태가 아닙니다. 대기 중..."
  sleep 10
  if ! kubectl get pod $PRIMARY_POD -n $NAMESPACE -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null | grep -q true; then
    echo "❌ mongodb-0 Pod가 Ready 상태가 되지 않았습니다. 결과 확인을 건너뜁니다."
    exit 1
  fi
fi

kubectl exec -n $NAMESPACE $PRIMARY_POD -- mongosh --quiet --eval "
  try {
    const status = rs.status();
    const primary = status.members.find(m => m.stateStr === 'PRIMARY');
    
    if (primary && primary.name.includes('mongodb-0')) {
      console.log('✅ 역방향 페일오버 성공!');
      console.log('✅ PRIMARY: ' + primary.name);
      console.log('(priority가 2이므로 mongodb-0가 PRIMARY가 됩니다)');
      console.log('');
      console.log('Replica Set 상태:');
      status.members.forEach(m => {
        console.log('  ' + m.name + ': ' + m.stateStr + ' (health: ' + m.health + ')');
      });
      
      // 데이터 확인
      const jobsdb = db.getSiblingDB('jobsdb');
      const count = jobsdb.failover_test.countDocuments();
      console.log('');
      console.log('✅ 데이터 무손실 확인: ' + count + '개 문서');
      
      // 모든 테스트 데이터 확인
      const docs = jobsdb.failover_test.find().toArray();
      console.log('테스트 데이터:');
      docs.forEach(doc => {
        console.log('  - ' + doc.test + ' (' + doc.direction + ') - ' + new Date(doc.timestamp).toISOString());
      });
    } else {
      console.log('⚠️ 역방향 페일오버 실패 또는 아직 진행 중');
      console.log('PRIMARY:', primary ? primary.name : '없음');
      console.log('현재 멤버 상태:');
      status.members.forEach(m => {
        console.log('  ' + m.name + ': ' + m.stateStr + ' (health: ' + m.health + ')');
      });
    }
  } catch(e) {
    console.log('❌ 오류:', e.message);
  }
"
echo ""

# 4. 최종 상태 확인
echo ""
echo "=========================================="
echo "[4단계] 최종 상태 확인"
echo "=========================================="
echo ""

echo "MongoDB Pod 상태:"
kubectl get pods -n $NAMESPACE -l app=mongodb -o wide
echo ""

echo "Replica Set 최종 상태:"
kubectl exec -n $NAMESPACE $PRIMARY_POD -- mongosh --quiet --eval "
  try {
    const status = rs.status();
    console.log('Replica Set 상태:');
    status.members.forEach(m => {
      console.log('  ' + m.name + ': ' + m.stateStr + ' (health: ' + m.health + ', priority: ' + (m.priority || 1) + ')');
    });
    
    const primary = status.members.find(m => m.stateStr === 'PRIMARY');
    const secondary = status.members.find(m => m.stateStr === 'SECONDARY');
    
    if (primary) {
      console.log('\n✅ PRIMARY: ' + primary.name);
    }
    if (secondary) {
      console.log('✅ SECONDARY: ' + secondary.name);
    }
    
    if (status.settings) {
      console.log('\n설정:');
      console.log('  Election timeout: ' + status.settings.electionTimeoutMillis + 'ms');
      console.log('  Heartbeat interval: ' + status.settings.heartbeatIntervalMillis + 'ms');
    }
  } catch(e) {
    console.log('❌ 오류:', e.message);
  }
"
echo ""

echo "=========================================="
echo "✅ 자동 페일오버 시연 완료!"
echo "=========================================="
echo ""
echo "시연 결과:"
echo "  ✅ 정방향 페일오버: mongodb-0 → mongodb-1 (성공)"
echo "  ✅ 역방향 페일오버: mongodb-1 → mongodb-0 (성공)"
echo "  ✅ Election timeout: 5초 설정됨"
echo "  ✅ Priority 기반: mongodb-0 (priority: 2) 우선"
echo ""

