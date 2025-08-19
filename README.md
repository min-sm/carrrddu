# Carrrddu

<p align="center">
  <img src="public/assets/logo.svg" alt="Logo" width="30%">
</p>

Carrrddu is a screenshot generator for Letterboxd reviews, built using Node.js. Users have to input the Letterboxd review link, which follows the formats "user/film/film-name/" or "user/film/film-name/number." I gave the name "Carrrddu" since the project is to generate a card, and the name partially comes from the Japanese word for card (カード). I made some changes to the word at the end, changing it to "du."
I took a lot of design and theme inspiration from Letterboxd since it's a project based on that platform. Since Letterboxd doesn't have a public API, I used Puppeteer to extract the data for generating the review cards.

## Installation

1. Install dependencies with npm
   ```bash
   npm install
   npm run devStart
   ```

2. Create a `.env` file in the root directory of your project and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
   Get your Gemini API key here: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
   <br>This part using the Gemini API is optional.

4. Go to `localhost:5000` and you are ready to go!
    
## Background

I like watching movies, and after watching them, I enjoy finding out more about the films and reading reviews. Letterboxd has some of the funniest reviews, and I wanted to share them, so I made a review card generator inspired by Twitter's tweet screenshot generators.
