# Latest rabbit hole (Zig)

Yesterday I fell into a rabbit hole. I was going through [permacomputing](https://permacomputing.net/) writings and there was a [section on programming](https://permacomputing.net/programming_languages/) which linked to a [this blog](https://drewdevault.com/2020/01/04/Slow.html) and Zig was second to Assembly in terms of Syscalls and size. If yousee the benchmarks:

[IMAGE](https://www.are.na/block/34076548)

Zig seems to have a very close mapping to Assembly, that means very little abstraction. But it seems (from a general scan of people writing and talking about it (blogs, youtube)) that it is a very enjoyable writing experience. Of course, it is a low level language, so that means you have to do manual memory allocation and such. I've always wanted to try making a project where I need to do manual memory allocation, just to learn about it so I was intrigued at this point. 

Also the minimal abstraction thing reminded me of Devin from 100rabbits' talk: 

[video](https://www.are.na/block/23651348)

This was a very influential talk for me and since then I've been thinking of computation very differently. I won't go into that talk right now, that's for another day but reader should definitely check this out.

Anyways,

So in my rabbit hole I watched a talk by the author of the language

[Video](https://www.are.na/block/34076735)


I really appreciated the ethical orientation towards language design. Even the foundation that is run is non-profit and sustainable in the are.na way, i.e. seek to raise enough money only to sustain a practice and not to extract capital from it. And overall orientation towards corporation and authors own [personal **actions**](https://andrewkelley.me/post/goodbye-twitter-reddit.html) mirroring this position. 


#### Sustainablity

[VIDEO](https://www.are.na/block/34076975)

#### Profits x Non-profits

[IMAGE](https://www.are.na/block/34076775)
[IMAGE](https://www.are.na/block/34076820)


[Talking about youtube-downloader ethics](https://youtu.be/SCLrNqc9jdE?t=1147)

I think I'm encouraged to learn this language -> so I can also learn about lower level computing protocols and paradigms. Not sure what the scope of this exploration will be, will know more once I start tinkering with the language to see how hard/easy it is. To start of I'm thinking of making either: 

1. A version of the static site generator that produces this website (currently written in javascript)
2. An api client for are.na 
>  - -> (and depending how that goes maybe writing another offline proxy server for are.na in Zig) 
>  - -> and if that works then a CLI client for using offline are.na data to make media pipes (querying and giving parameters for outputing files (can be piped with opencv, fffmpeg, pdf, etc to make media object for design))

Lets see... will keep the reader posted.

