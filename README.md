# Carrrddu

Carrrddu is a screenshot generator for Letterboxd reviews, built using Node.js. Users have to input the Letterboxd review link, which follows the formats "user/film/film-name/" or "user/film/film-name/number." I gave the name "Carrrddu" since the project is to generate a card, and the name partially comes from the Japanese word for card (カード). I made some changes to the word at the end, changing it to "du."
I took a lot of design and theme inspiration from Letterboxd since it's a project based on that platform. Since Letterboxd doesn't have a public API, I used Puppeteer to extract the data for generating the review cards.

## Installation

Install carrrddu with npm

```bash
  npm install 
  npm run devStart
```

Go to `localhost:5000` and you are ready to go!
    
## Background

I like watching movies, and after watching them, I enjoy finding out more about the films and reading reviews. Letterboxd has some of the funniest reviews, and I wanted to share them, so I made a review card generator inspired by Twitter's tweet screenshot generators.