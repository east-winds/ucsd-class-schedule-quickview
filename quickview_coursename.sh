#!/bin/bash

FN="$(basename ${0} .sh)"
NAME=$1
if [ -z "$2" ]
	then
		NO_YRS=3
	else
		NO_YRS=$2
fi
TERMS=$(./retrieve_terms.sh $NO_YRS)


rm ${FN}.html

for i in $TERMS; do

	echo "<h1>$i</h1>" >> ${FN}.html

	curl 'https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesFacultyResult.htm' -H 'Connection: keep-alive' -H 'Cache-Control: max-age=0' -H 'Origin: https://act.ucsd.edu' -H 'Upgrade-Insecure-Requests: 1' -H 'DNT: 1' -H 'Content-Type: application/x-www-form-urlencoded' -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36' -H 'Sec-Fetch-User: ?1' -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9' -H 'Sec-Fetch-Site: same-origin' -H 'Sec-Fetch-Mode: navigate' -H 'Referer: https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesFaculty.htm' -H 'Accept-Encoding: gzip, deflate, br' -H 'Accept-Language: en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7' -H 'Cookie: JSESSIONID=B6CB707712F37B5E32A343A6CEF4806D; _ga=GA1.2.1217531734.1572906884; UqZBpD3n=v1aGY+JQ__lNG; __utmc=57960238; jlinkauthserver=cavouras; jlinksessionidx=z1e58f5f4e4448be283a451fc3570b35f; _fbp=fb.1.1573170283003.1190272420; jlinkserver=act; jlinkauthserver=cavouras; jssoserver=cavouras; SID=15732611731286; SLID=zfcdc2402790aa6cf25bcc60db282dd29; sen_identity=JQR4MFtJpTFHwdlEY7huE0REGzk2aORxohfXYjqws4o2A/SI3y3nNy9kI2d1F6YrYNOmRLoZMA8j02XX5aIGoG+fjc4/iigBcOB47Vq6oCz1GrusUwIG5jCGxQwV3Q+ctVmkdOTIExE0CzvGdDjgNsXWJf+60brT3y1FIOWLBLJpMl1gbg347DRwZOizeo7U3joNngHA4B7MQ84KZhEMU0YHNB2+LcRIKSa4ZFv+pbevvgOA8AYQ9psIz+FdiVD6Laitl+xVmRt9yoSgmWkcK7ftbfiNeB8ZeBf1Ecufr2aXCNZnrbwLteiFruwUxmfOmXKIk8PY7s9Zp+2nJxEE29ZuzfQKp9z1zdUs/Ov0srLXVK3rGD0KGsaVDRTMVsPAVebzKPKmxCJM40VoCiacox8z+FeSH4McigD1K1fCKr3XvFg0SnJYmdG8ikVe+cSInuKDctVaDOvDvwuEXyuqBcVVe/7Z1VDQWGdKvZtRSgxnT4ebyAC7ye9v35Bi1lUgwZm0cOP3e4lHJnuhFlOsJqU9+RwbhsglTKAMbx68fTwLkvoHCcI2K3UnX5EH8jqo9ciMiXkXECwC1O7dGzJCLQJy74ssQXQlNNTqh0DmCMeASDdhz1rYPH22YKL3D4PsEQHVwb8GyKC+S0+iHzfQiMklcAe+E/Fo5zpLoZSH6Hc+1E5XBlfFtPw/HWSF3l09DONrsEy0q6Y2j+6J+CNp0M1uUoomvYzRqnkmRSYc00P415o2liKaLm07CfTJK9zVNWhe1k03L2DJJF/1qIdYDSb0buPqBbLFdy9/MsDF1/QlRMU2y3+6C1cKJeXolESZ; _hjid=23184914-895f-4065-a1c8-0774ea3c39c2; xjlinkloginStaff.InquiryA4=OK; __unam=aaacafd-16e8a050ae0-5554726-2; __qca=P0-2041804169-1575248555037; SESSION_LANGUAGE=eng; III_EXPT_FILE=aa5588; III_SESSION_ID=0aef1097b0951e7581947d2b16b500f6; jlinkappx=/mydirectory/updater; _shibsession_64656661756c7468747470733a2f2f6163742e756373642e6564752f73686962626f6c6574682d7370=_478e3e86791128a2bf2981874d372a3f; _gid=GA1.2.1601507457.1578951239; __utma=57960238.1217531734.1572906884.1578440892.1579047492.23; __utmz=57960238.1579047492.23.21.utmcsr=mdavidson.org|utmccn=(referral)|utmcmd=referral|utmcct=/mentoring/; __utmt=1; __utmb=57960238.8.10.1579047492' --data "selectedTerm=${i}&tabNum=tabs-crs&_selectedSubjects=1&schedOption1=true&_schedOption1=on&_schedOption11=on&_schedOption12=on&schedOption2=true&_schedOption2=on&_schedOption4=on&_schedOption5=on&_schedOption3=on&_schedOption7=on&_schedOption8=on&_schedOption13=on&_schedOption10=on&_schedOption9=on&schDay=M&_schDay=on&schDay=T&_schDay=on&schDay=W&_schDay=on&schDay=R&_schDay=on&schDay=F&_schDay=on&schDay=S&_schDay=on&schStartTime=12%3A00&schStartAmPm=0&schEndTime=12%3A00&schEndAmPm=0&_selectedDepartments=1&schedOption1Dept=true&_schedOption1Dept=on&_schedOption11Dept=on&_schedOption12Dept=on&schedOption2Dept=true&_schedOption2Dept=on&_schedOption4Dept=on&_schedOption5Dept=on&_schedOption3Dept=on&_schedOption7Dept=on&_schedOption8Dept=on&_schedOption13Dept=on&_schedOption10Dept=on&_schedOption9Dept=on&schDayDept=M&_schDayDept=on&schDayDept=T&_schDayDept=on&schDayDept=W&_schDayDept=on&schDayDept=R&_schDayDept=on&schDayDept=F&_schDayDept=on&schDayDept=S&_schDayDept=on&schStartTimeDept=12%3A00&schStartAmPmDept=0&schEndTimeDept=12%3A00&schEndAmPmDept=0&courses=${NAME}&sections=&instructorType=begin&instructor=&titleType=contain&title=&_hideFullSec=on&_showPopup=on" --compressed > temp.html

	sed -e "1,/<h1>Schedule of Classes<\/h1>/d" temp.html >> ${FN}.html
done

rm temp.html
open ${FN}.html
