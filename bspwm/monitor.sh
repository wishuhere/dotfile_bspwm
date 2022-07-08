#!/bin/bash
wal -i $HOME/.config/wallpaper &

x=$(xrandr --listmonitors | grep "+"|wc -l)

if [ $x -eq 2 ]
then 
	xrandr --output HDMI2 --rate 75 --auto --output eDP1 --rate 60 --auto --right-of HDMI2;
	bspc wm -r; 
else
  if [ $x -eq 1 ]
  then 
	  xrandr --output eDP1 --rate 60 --auto;
	  bspc wm -r;
  fi
fi
