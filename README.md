# Eugene Profile

개인 프로필 페이지와 근무시간 계산기, 그리고 크롬 확장(Work Clock) 관련 파일이 포함된 저장소입니다.

## 구성

- `index.html`: 메인 페이지
- `work-clock.html`: 근무시간 계산기(북마크릿 설명 + 데모)
- `work-clock-extension/`: 크롬 확장 소스
- `work-clock-extension.zip`: 배포용 압축 파일
- `build-extension.sh`: 확장 자동 재압축 스크립트
- `clock.svg`: 파비콘/아이콘 원본

## 로컬에서 확인

이 프로젝트는 `fetch`를 사용합니다. 로컬에서 `file://`로 열면 일부 정보가 표시되지 않을 수 있습니다.

1. 터미널에서 아래 실행
```
python3 -m http.server
```

2. 브라우저에서 접속
```
http://localhost:8000
```

## Work Clock 확장 설치

1. 크롬에서 `chrome://extensions` 접속
2. 우측 상단 **개발자 모드** ON
3. **압축해제된 확장 프로그램 로드** 클릭
4. `/Users/eugene/Documents/GitHub/eugene-profile/work-clock-extension` 폴더 선택

## 단축키 설정

1. `chrome://extensions/shortcuts` 접속
2. Work Clock 항목에 원하는 키 설정
3. 기본 제안 키: `Alt+Shift+W`

## 확장 실행 동작

- 현재 탭이 Workplace이면 바로 실행
- Workplace 탭이 열려 있으면 그 탭으로 이동 후 실행
- 없으면 새 탭을 열고 로드 완료 후 실행

## 확장 업데이트

`manifest.json`의 버전과 업데이트 날짜를 수정한 뒤 아래 스크립트를 실행합니다.

```
/Users/eugene/Documents/GitHub/eugene-profile/build-extension.sh
```

## 메타 정보 표시

메인 페이지의 확장 버전/업데이트 날짜는 `work-clock-extension/manifest.json`에서 읽어 표시합니다.
서버로 열었을 때만 표시되는 것이 정상입니다.
