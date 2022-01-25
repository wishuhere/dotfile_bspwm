#!/bin/bash

x=$(xrandr --listmonitors | grep "+"|wc -l)

if [ $x -eq 2 ]
then xrandr --output HDMI2 --auto --output eDP1 --auto --right-of HDMI2 | bspc wm -r; 
else
  if [ $x -eq 1 ]
  then xrandr --output eDP1 --auto | bspc wm -r;
  fi
fi
