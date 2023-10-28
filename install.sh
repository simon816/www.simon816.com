#!/bin/sh
if which apt
then
    apt install ruby
else
    yum install -y ruby
fi
gem install liquid -v 5.3.0
