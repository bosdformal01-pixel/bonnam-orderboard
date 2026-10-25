# 배달앱 전표 시험

배달앱 전표 → 주문판 → 샐러드바/샌드위치바 표 → 주문판 전표 출력까지 크롬(Playwright)으로 끝까지 돌려 봐요.
진짜 프린터·저장소 대신 가짜 COM4 와 가짜 저장소를 써요. 실제 주문 기록은 건드리지 않아요.

```
node tests/relay-e2e.js . out 10        # 시험 주문 10건 (13만 원 넘게, 1인세트 포함)
SEED=777 node tests/relay-e2e.js . out 200
```

주문판의 전표 읽기(parseSlip, appItem)를 고친 뒤에는 꼭 돌려서 모두 '성공'인지 봐요.
