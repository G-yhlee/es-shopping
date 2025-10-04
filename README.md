# Shopping Cart Event Sourcing with Emmett

Event Sourcing을 활용한 쇼핑카트 시뮬레이션 프로젝트입니다. Emmett 프레임워크를 사용하여 구현되었습니다.

## 프로젝트 구조

```
src/
├── shoppingCart/
│   ├── types/          # 도메인 타입 정의
│   ├── events/         # 이벤트 정의
│   ├── commands/       # 커맨드 정의
│   ├── domain/         # 비즈니스 로직 (aggregate)
│   ├── projections/    # 읽기 모델 프로젝션
│   └── api/            # REST API 엔드포인트
├── tests/              # 테스트
└── index.ts            # 메인 애플리케이션
```

## 주요 기능

### 이벤트
- `ShoppingCartOpened`: 장바구니 생성
- `ProductItemAddedToShoppingCart`: 상품 추가
- `ProductItemRemovedFromShoppingCart`: 상품 제거
- `ShoppingCartConfirmed`: 장바구니 확정
- `ShoppingCartCancelled`: 장바구니 취소

### API 엔드포인트
- `POST /carts` - 새 장바구니 생성
- `POST /carts/:id/items` - 상품 추가
- `DELETE /carts/:id/items/:productId` - 상품 제거
- `POST /carts/:id/confirm` - 장바구니 확정
- `POST /carts/:id/cancel` - 장바구니 취소
- `GET /carts/:id` - 장바구니 조회

## 실행 방법

### 개발 서버 실행
```bash
npm run dev
```

### 테스트 실행
```bash
npm test
```

### 빌드
```bash
npm run build
```

### 프로덕션 실행
```bash
npm start
```

## API 사용 예제

### 1. 장바구니 생성
```bash
curl -X POST http://localhost:3000/carts \
  -H "Content-Type: application/json" \
  -d '{"customerId": "customer-123"}'
```

### 2. 상품 추가
```bash
curl -X POST http://localhost:3000/carts/{cartId}/items \
  -H "Content-Type: application/json" \
  -H "If-Match: W/\"0\"" \
  -d '{
    "productId": "product-001",
    "productName": "Sample Product",
    "quantity": 2
  }'
```

### 3. 장바구니 확정
```bash
curl -X POST http://localhost:3000/carts/{cartId}/confirm \
  -H "If-Match: W/\"1\""
```

## 테스트 상품

서버에는 다음과 같은 테스트 상품이 미리 등록되어 있습니다:
- product-001: $29.99
- product-002: $49.99
- product-003: $19.99
- product-004: $99.99
- product-005: $149.99

## Event Sourcing 개념

이 프로젝트는 Event Sourcing 패턴을 구현합니다:
- 모든 상태 변경은 이벤트로 기록됩니다
- 현재 상태는 이벤트를 재생하여 얻습니다
- 비즈니스 로직은 Command → Event 변환으로 표현됩니다
- Projections를 통해 읽기 모델을 구성합니다