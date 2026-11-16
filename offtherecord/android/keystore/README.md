# 서명 키

- `otr-release.keystore`, `keystore.properties` 는 Git 에 올리지 않아요 (.gitignore).
- 따로 받은 zip 을 이 폴더에 풀면 `./gradlew assembleRelease` / `bundleRelease` 가 이 키로 서명해요.
- 잃어버리면 같은 앱으로 업데이트할 수 없으니 안전한 곳에 두 벌 이상 보관하세요.
