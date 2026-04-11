# SonarQube Profile

## Profile
- Name: `Sonar way-EXP`
- Language: JavaScript (`js`)
- Scope: Repository reference copy of the SonarQube coding-standard baseline used for this project

## Enforcement
- Blocker and Critical findings are treated as merge blockers for new or modified code.
- The baseline covers Sonar JavaScript, `jsarchitecture`, and `jssecurity` repositories.

## Custom Thresholds
- `S101`: naming format `^\$?[A-Z][a-zA-Z0-9]*$`
- `S107`: maximum function parameters `7`
- `S1479`: maximum switch cases `30`
- `S2004`: maximum nested control flow depth `4`
- `S2068`: password words `password,pwd,passwd,passphrase`
- `S2999`: `considerJSDoc=false`
- `S3776`: cognitive complexity threshold `15`
- `S4275`: `allowImplicit=false`
- `S5604`: permission set `geolocation`
- `S5693`: file upload size limit `8000000`, standard size limit `2000000`
- `S5843`: regex complexity threshold `20`
- `S6418`: randomness sensibility `5.0`, secret words `api[_.-]?key,auth,credential,secret,token`
- `S7718`: ignored short variable names `^(e|ex)$,[eE][xX][cC][eE][pP][tT][iI][oO][nN]$,[eE][rR][rR]$,^_,^\w\$\d+$,^[cC][aA][uU][sS][eE]$,^[rR][eE][aA][sS][oO][nN]$`

## Notes
- This Markdown file replaces the previous XML snapshot (`SonarQubeProfile.xml`).
- Use this file as the repo-local, human-readable source of truth when reviewing Sonar compliance expectations.
- The live SonarQube server profile remains authoritative for CI analysis behavior.