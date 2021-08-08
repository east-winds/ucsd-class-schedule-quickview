#!/bin/bash

FN="$(basename ${0} .sh)"
NAME=$1
TERMS="FA21
SA21
SP21
WI21
FA20
SA20
SP20
WI20
FA19
SA19
SP19
WI19
FA18
SA18
SP18
WI18
FA17"

rm ${FN}.html

for i in $TERMS; do

	echo "<h1>$i</h1>" >> ${FN}.html

	curl 'https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesFacultyResult.htm' -H 'Connection: keep-alive' -H 'Cache-Control: max-age=0' -H 'Origin: https://act.ucsd.edu' -H 'Upgrade-Insecure-Requests: 1' -H 'Content-Type: application/x-www-form-urlencoded' -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36' -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8' -H 'Referer: https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesFaculty.htm' -H 'Accept-Encoding: gzip, deflate, br' -H 'Accept-Language: en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7' -H 'Cookie: _ga=GA1.2.58587174.1546203373; sto-id=EJLEBAKM; _fbp=fb.1.1550273286134.1622915849; __utmc=57960238; __utmz=57960238.1550614952.2.2.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); jlinkauthserver=cavouras; jlinksessionidx=z54a682ed275a521131d15b5f8e85b96a; _gid=GA1.2.1936778310.1550958211; __utma=57960238.58587174.1546203373.1550614952.1550958537.3; __utmt=1; __utmb=57960238.17.10.1550958537' --data "selectedTerm=${i}&tabNum=tabs-ins&_selectedSubjects=1&schedOption1=true&_schedOption1=on&_schedOption11=on&_schedOption12=on&schedOption2=true&_schedOption2=on&_schedOption4=on&_schedOption5=on&_schedOption3=on&_schedOption7=on&_schedOption8=on&_schedOption13=on&_schedOption10=on&_schedOption9=on&schDay=M&_schDay=on&schDay=T&_schDay=on&schDay=W&_schDay=on&schDay=R&_schDay=on&schDay=F&_schDay=on&schDay=S&_schDay=on&schStartTime=12%3A00&schStartAmPm=0&schEndTime=12%3A00&schEndAmPm=0&_selectedDepartments=1&schedOption1Dept=true&_schedOption1Dept=on&_schedOption11Dept=on&_schedOption12Dept=on&schedOption2Dept=true&_schedOption2Dept=on&_schedOption4Dept=on&_schedOption5Dept=on&_schedOption3Dept=on&_schedOption7Dept=on&_schedOption8Dept=on&_schedOption13Dept=on&_schedOption10Dept=on&_schedOption9Dept=on&schDayDept=M&_schDayDept=on&schDayDept=T&_schDayDept=on&schDayDept=W&_schDayDept=on&schDayDept=R&_schDayDept=on&schDayDept=F&_schDayDept=on&schDayDept=S&_schDayDept=on&schStartTimeDept=12%3A00&schStartAmPmDept=0&schEndTimeDept=12%3A00&schEndAmPmDept=0&courses=&sections=&instructorType=begin&instructor=${NAME}&titleType=contain&title=&_hideFullSec=on&_showPopup=on" --compressed > temp.html

	sed -e "1,/<h1>Schedule of Classes<\/h1>/d" temp.html >> ${FN}.html
done

rm temp.html
open ${FN}.html
