#!/bin/bash

builddir="_build"

rm -rf $builddir

OLD_IFS=$IFS
IFS=$(echo -en "\n\b")

for f in $(find ./ -type f)
do
    if [[ $f =~ (^\./(\.|_template)|\.(rb|sh|py)$) ]]
    then
        continue
    fi
    dest="$builddir/$f"
    mkdir -p $(dirname $dest)
    echo $dest
    if [[ $f =~ \.html$ ]]
    then
        ruby render_template.rb < $f > $dest
    else
       cp $f $dest
    fi
done

IFS=$OLD_IFS
