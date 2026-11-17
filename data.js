/* ───── 여기만 채우면 됩니다 ─────
   photos의 src에 사진 파일 경로, date에 필름 날짜, cap에 한 줄 메모. */
const BOOK = {
  names: '이름 ♡ 이름',
  intro: '아직 견본이에요. 사진과 이야기를 보내주시면 이 자리에 채워집니다.',
  months: [
    { m:1,  title:'제목을 적어요', text:'새해 첫날, 우리 어디서 뭘 했더라?',        photos:[{src:'',date:"'26 1 1",cap:''}] },
    { m:2,  title:'제목을 적어요', text:'추웠던 날 같이 먹은 것, 같이 본 것.',       photos:[{src:'',date:"'26 2 14",cap:''}] },
    { m:3,  title:'제목을 적어요', text:'봄이 오던 무렵의 기억.',                    photos:[{src:'',date:"'26 3 --",cap:''},{src:'',date:"'26 3 --",cap:''}] },
    { m:4,  title:'제목을 적어요', text:'꽃 보러 간 날이 있었나요?',                 photos:[{src:'',date:"'26 4 --",cap:''}] },
    { m:5,  title:'제목을 적어요', text:'가장 많이 웃었던 하루.',                    photos:[{src:'',date:"'26 5 --",cap:''}] },
    { m:6,  title:'제목을 적어요', text:'장마철, 우산 하나로 걷던 길.',              photos:[{src:'',date:"'26 6 --",cap:''}] },
    { m:7,  title:'제목을 적어요', text:'여름 여행의 한 장면.',                      photos:[{src:'',date:"'26 7 --",cap:''},{src:'',date:"'26 7 --",cap:''}] },
    { m:8,  title:'제목을 적어요', text:'더위를 피해 숨어든 곳.',                    photos:[{src:'',date:"'26 8 --",cap:''}] },
    { m:9,  title:'제목을 적어요', text:'선선해진 저녁의 산책.',                     photos:[{src:'',date:"'26 9 --",cap:''}] },
    { m:10, title:'제목을 적어요', text:'가을에 같이 간 곳.',                        photos:[{src:'',date:"'26 10 --",cap:''}] },
    { m:11, title:'제목을 적어요', text:'요즘의 우리.',                              photos:[{src:'',date:"'26 11 --",cap:''}] },
    { m:12, pending:true, title:'아직 찍는 중', text:'마지막 한 컷은 남겨둘게. 12월은 같이 채우자.', photos:[] },
  ],
  letter: { title:'한 해의 끝에서', body:['여기에 전하고 싶은 말을 적어요.'], sign:'— 이름' },
};
