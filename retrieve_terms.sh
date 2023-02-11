#!/bin/bash

curr_yr=$(date +'%y')
curr_mo=$(($(date +'%m')))
NO_YRS=$1

TERMS=""

for (( y=$((curr_yr-NO_YRS)); y<$curr_yr; y++ ))
do
	TERMS="FA$y
	SA$y
	SP$y
	WI$y
	$TERMS"
done

case $curr_mo in
	1 | 2 | 3)
		TERMS="SP$y
		WI$y
		$TERMS"
		;;

	4 | 5 | 6)
		TERMS="SA$y
		SP$y
		WI$y
		$TERMS"
		;;

	7 | 8 | 9)
		TERMS="FA$y
		SA$y
		SP$y
		WI$y
		$TERMS"
		;;

	10 | 11 | 12)
		yp=$(($y+1))
		TERMS="WI$yp
		FA$y
		SA$y
		SP$y
		WI$y
		$TERMS"
		;;

esac

echo $TERMS
