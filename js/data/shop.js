// 상점 진열대(사는 물건)와 여관 요금. 파는 가격은 data/items.js 의 sell, 사는 가격은 여기의 price.
// needs 가 있으면 골드 외에 그 아이템도 함께 내야 한다 (장비는 이렇게 산다).
// 사는 가격이 파는 가격보다 항상 높게 정한다.
const ShopStock = {
  shop: [
    { id: 'hp_potion', price: 30 },
    { id: 'mp_potion', price: 30 },
    { id: 'upgrade_stone', price: 100 },
    // 무기: 골드와 함께 몬스터 소재(needs)를 내야 살 수 있다 (등급 1)
    { id: 'iron_dagger', price: 200, needs: [{ id: 'rat_tail', count: 5 }, { id: 'slime_jelly', count: 5 }] },
    { id: 'hunter_axe', price: 500, needs: [{ id: 'mushroom_cap', count: 8 }, { id: 'rat_tail', count: 8 }, { id: 'upgrade_stone', count: 2 }] },
  ],
};

const Services = {
  innCost: 5,        // 여관에서 쉬는 값 (HP/MP 모두 회복)
};
