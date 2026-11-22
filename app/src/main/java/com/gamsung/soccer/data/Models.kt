package com.gamsung.soccer.data

enum class Pos { GK, CB, FB, DM, CM, CAM, WG, ST }

/** 1차 대상 리그. id는 이미지/데이터 매핑용 고정 키. */
enum class League(val label: String, val tier: Int) {
    EPL("잉글랜드 1부", 1), EFL("잉글랜드 2부", 2),
    LALIGA("라리가 1부", 1), LALIGA2("라리가 2부", 2),
    SERIEA("세리에 A", 1), SERIEB("세리에 B", 2),
    LIGUE1("프랑스 1부", 1), LIGUE2("프랑스 2부", 2),
    LIGA_PT1("포르투갈 1부", 1), LIGA_PT2("포르투갈 2부", 2),
    SUPER_LIG("튀르키예 1부", 1)
}

data class Club(val id: String, val name: String, val league: League)

data class Player(
    val name: String,
    val pos: Pos,
    val age: Int,
    val ovr: Int,
    val salary: Long,
    val clubId: String,
    val stamina: Int = 100,
)

data class GameState(
    val season: Int = 1,
    val week: Int = 1,
    val player: Player,
    val seasonWeeks: Int = 34,
) {
    /** 한 주 진행. 시즌 끝이면 나이 +1, 주차 리셋. 훈련 효과는 다음 단계에서. */
    fun nextWeek(): GameState =
        if (week >= seasonWeeks)
            copy(season = season + 1, week = 1, player = player.copy(age = player.age + 1, stamina = 100))
        else copy(week = week + 1)
}
