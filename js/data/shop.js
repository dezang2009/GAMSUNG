// 상점 진열대(사는 물건)와 여관 요금. 파는 가격은 data/items.js 의 sell, 사는 가격은 여기의 price.
// 사는 가격이 파는 가격보다 항상 높게 정한다.
const ShopStock = {
  shop: [
    { id: 'hp_potion', price: 30 },
    { id: 'mp_potion', price: 30 },
    { id: 'upgrade_stone', price: 100 },
  ],
};

const Services = {
  innCost: 5,        // 여관에서 쉬는 값 (HP/MP 모두 회복)
};
