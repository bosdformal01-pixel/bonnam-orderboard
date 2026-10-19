# 복남이 샌드 주문판

카운터 포스와 샐러드바·샌드위치바 태블릿에서 같이 쓰는 주문판이에요.

- 주소: https://bosdformal01-pixel.github.io/bonnam-orderboard/
  - 카운터: `#counter`, 샐러드바: `#salad`, 샌드위치바: `#sandwich`
- 주문은 구글 Firebase(프로젝트 `bosd-project`)에 저장돼요. `firestore.rules`에 적힌 가게 구글 계정으로 로그인한 기기만 주문을 읽고 쓸 수 있어요. 이 저장소에는 주문 내용이 들어 있지 않아요.
- 전표는 카운터 포스의 영수증 프린터(COM4, 9600)로 바로 나가요. 처음 한 번 "🔌 영수증 프린터 연결하기"를 눌러 COM4를 골라 주세요. (크롬에서만 돼요)
