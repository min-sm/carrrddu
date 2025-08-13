"use strict";
const express = require("express");
const app = express();
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const https = require("https");
const dotenv = require("dotenv");
dotenv.config();

const PORT = process.env.PORT || 5000;

app.use(express.static("public"));
app.use(express.static("src"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index");
});

app.post("/result", async (req, res) => {
  const reviewLink = req.body.review_link;

  try {
    const browser = await puppeteer.launch({
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--single-process",
        "--no-zygote",
      ],
      executablePath:
        process.env.NODE_ENV === "production"
          ? process.env.PUPPETEER_EXECUTABLE_PATH
          : puppeteer.executablePath(),
      headless: true,
      timeout: 60000,
      defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.goto(`${reviewLink}`, { waitUntil: "domcontentloaded" });

    const targetSelector = `img[width="150"][height="225"][src^="https://a.ltrbxd.com/resized"]`;
    await page.waitForSelector(targetSelector);

    async function getTextContent(page, selector) {
      const text = await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (sel.includes(`div.review`)) {
          return element ? element.innerHTML.trim() : null;
        }
        return element ? element.textContent.trim() : null;
      }, selector);
      return text;
    }

    const hasSpoilers = async (page) => {
      const hasSpoiler = await page.evaluate(
        () =>
          document.querySelector(`div.review>div.contains-spoilers`) !== null
      );
      return hasSpoiler;
    };

    const hasSpoiler = await hasSpoilers(page);

    let review =
      (await getTextContent(page, `div.review div > h3 ~ div`)) ??
      (await getTextContent(
        page,
        `div.review div > p.prior-review-link ~ div`
      ));

    const reviewerName = await getTextContent(page, `span[itemprop='name']`);

    const movieName = await getTextContent(page, `h2.name.-primary.prettify>a`);
    // const movieName = await getTextContent(page, `span.film-title-wrapper>a`);

    const movieYear = await getTextContent(
      page,
      `span.releasedate>a`
      // `span.film-title-wrapper>small>a`
    );

    const rating = await getTextContent(page, `span.rating.rating-large`);

    let watchedDate = await getTextContent(page, `p.view-date.date-links`);
    watchedDate = watchedDate.replace(/\s+/g, " ");

    const likes =
      (await getTextContent(page, `p.like-link-target`)) ??
      (await getTextContent(page, `a[href="${reviewLink.slice(22)}/likes/"]`));
    console.log(typeof likes);
    console.log(`Likes: a${likes}a`);

    // Replace the existing posterSrc code with:
    const posterSrc = await page.evaluate(() => {
      // Use the same selector we already confirmed exists
      const img = document.querySelector(
        'img[width="150"][height="225"][src^="https://a.ltrbxd.com/resized"]'
      );
      return img ? img.src.trim() : null;
    });

    const reviewerPicSrc = await page.evaluate((reviewerName) => {
      let imgElement = document.querySelector(`img[alt="${reviewerName}"]`);
      return imgElement ? imgElement.src.trim() : null;
    }, reviewerName);
    console.log(`reviewer: ${reviewerPicSrc}\nposter: ${posterSrc}`);

    let newDimensions = "-0-1000-0-1500-";
    let replacedUrl = posterSrc.replace(/-0-(\d+)-0-(\d+)-/, newDimensions);
    // Handle potential null values for images
    let posterBetterSrc = posterSrc;
    let reviewerPicBetterSrc = reviewerPicSrc;

    if (posterSrc) {
      const newDimensions = "-0-1000-0-1500-";
      posterBetterSrc = posterSrc.replace(/-0-(\d+)-0-(\d+)-/, newDimensions);
    }

    if (reviewerPicSrc) {
      const newDimensions = "-0-1000-0-1000-";
      reviewerPicBetterSrc = reviewerPicSrc.replace(
        /-0-(\d+)-0-(\d+)-/,
        newDimensions
      );
    }

    // If the values (movieName, reviewerName, review, movieYear, rating, watchedDate, likes, hasSpoiler, posterBetterSrc, reviewerPicBetterSrc) are null, we will use gemini ai. send the webpage and ask the AI to return me those values



    const renderedHTML = await new Promise((resolve, reject) => {
      res.render(
        "result1",
        {
          data: {
            movieName,
            reviewerName,
            review,
            movieYear,
            rating,
            watchedDate,
            likes,
            hasSpoiler,
            posterBetterSrc,
            reviewerPicBetterSrc,
          },
        },
        (err, html) => {
          if (err) {
            reject(err);
          } else {
            resolve(html);
          }
        }
      );
    });

    res.render("result", {
      data: {
        renderedHTML,
        movieName,
        reviewerName,
        review,
        movieYear,
        rating,
        watchedDate,
        likes,
        hasSpoiler,
        posterBetterSrc,
        reviewerPicBetterSrc,
      },
    });
    await browser.close();
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching the review" });
  }
});

app.post("/download", async (req, res) => {
  const renderedHTML = req.body.renderedHTML; // Assuming you send it in the request body

  try {
    const browser = await puppeteer.launch({
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--single-process",
        "--no-zygote",
      ],
      executablePath:
        process.env.NODE_ENV === "production"
          ? process.env.PUPPETEER_EXECUTABLE_PATH
          : puppeteer.executablePath(),
      headless: true,
      defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.setContent(renderedHTML);

    // Capture the screenshot of the desired element
    const element = await page.$("#htmlContent");
    const screenshotBuffer = await element.screenshot();

    await browser.close();

    // Set the appropriate headers for image download
    res.setHeader("Content-Disposition", "attachment; filename=card.png");
    res.setHeader("Content-Type", "image/png");

    // Send the screenshot buffer as a response
    res.send(screenshotBuffer);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "An error occurred while generating the screenshot" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
