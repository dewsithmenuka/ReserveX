#!/usr/bin/env bash
# usage: bash tests/concurrency.sh 2030-05-01 [resourceId]
DAY=${1:?usage: bash tests/concurrency.sh YYYY-MM-DD [resourceId]}
R=${2:-10000000-0000-4000-8000-000000000001}
URL=http://localhost:3000/api
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST $URL/reservations \
    -H "Content-Type: application/json" \
    -d '{"resourceId":"'$R'","reservedByName":"Racer '$i'","reservedByEmail":"r'$i'@example.com","purpose":"Race","startAt":"'$DAY'T10:00:00Z","endAt":"'$DAY'T11:00:00Z"}' &
done | sort | uniq -c
wait