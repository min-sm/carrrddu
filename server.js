"use strict";
const express = require("express");
const app = express();
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const https = require("https");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");
dotenv.config();

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// Initialize Gemini AI -- THIS IS NEW
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

  let browser; // Define browser outside the try block to close it in case of an AI error

  try {
    browser = await puppeteer.launch({
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
      return page.evaluate(
        () =>
          document.querySelector(`div.review>div.contains-spoilers`) !== null
      );
    };

    // --- Let's put all scraped data into one object for easier handling ---
    const scrapedData = {
      review:
        (await getTextContent(page, `div.review div > h3 ~ div`)) ??
        (await getTextContent(
          page,
          `div.review div > p.prior-review-link ~ div`
        )),
      reviewerName: await getTextContent(page, `span[itemprop='name']`),
      movieName: await getTextContent(page, `h2.name.-primary.prettify>a`),
      movieYear: await getTextContent(page, `span.releasedate>a`),
      rating: await getTextContent(page, `span.rating.rating-large`),
      watchedDate:
        (await getTextContent(page, `p.view-date.date-links`))?.replace(
          /\s+/g,
          " "
        ) ?? null,
      likes:
        (await getTextContent(page, `p.like-link-target`)) ??
        (await getTextContent(
          page,
          `a[href="${reviewLink.slice(22)}/likes/"]`
        )),
      hasSpoiler: await hasSpoilers(page),
      posterSrc: await page.evaluate(() => {
        const img = document.querySelector(
          'img[width="150"][height="225"][src^="https://a.ltrbxd.com/resized"]'
        );
        return img ? img.src.trim() : null;
      }),
      reviewerPicSrc: null, // We'll get this after getting reviewerName
    };

    scrapedData.reviewerPicSrc = await page.evaluate((reviewerName) => {
      if (!reviewerName) return null;
      let imgElement = document.querySelector(`img[alt="${reviewerName}"]`);
      return imgElement ? imgElement.src.trim() : null;
    }, scrapedData.reviewerName);

    // ##################################################################
    // ## START OF NEW GEMINI AI INTEGRATION LOGIC ##
    // ##################################################################

    // Check if any of the crucial values are null
    const missingFields = Object.keys(scrapedData).filter(
      (key) => scrapedData[key] === null || scrapedData[key] === undefined
    );

    if (missingFields.length > 0) {
      console.log(
        "Scraping failed for some fields. Asking Gemini for help...",
        missingFields
      );

      // 1. Get the full HTML content of the page
      const htmlContent = await page.content();

      // 2. Create a detailed prompt for Gemini
      const prompt = `
        You are an expert web page analyst. From the following HTML content of a Letterboxd review page, please extract the specified missing information.
        The fields I need are: ${missingFields.join(", ")}.

        Here are details for each field:
        - movieName: The title of the film being reviewed.
        - reviewerName: The name of the person who wrote the review.
        - review: The main text content of the review itself, in HTML format.
        - movieYear: The release year of the film.
        - rating: The star rating given. For example, "★★★★½".
        - watchedDate: The date the film was marked as watched. For example, "Watched on Aug 12, 2025".
        - likes: The number of likes the review has, as text. For example, "1,234 likes".
        - posterSrc: The full URL for the movie poster image.
        - reviewerPicSrc: The full URL for the reviewer's profile picture.

        Please return the data as a single, minified JSON object. Do not include any text, explanations, or markdown formatting like \`\`\`json.
        If a value cannot be found in the HTML, return null for that key.

        Example response format: {"movieName": "Dune: Part Two", "reviewerName": "John Doe", "review": "<p>Amazing film!</p>"}

        HTML Content:
        ${htmlContent}
      `;

      try {
        // 3. Call the Gemini API
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // 4. Parse the JSON response from the AI
        const cleanedText = text.replace('```json\n', '').replace('```', '');
        const aiData = JSON.parse(cleanedText);
        console.log("Gemini responded with:", aiData);

        // 5. Merge the AI's data with our scraped data
        for (const key of missingFields) {
          if (aiData[key]) {
            // If AI found a value
            scrapedData[key] = aiData[key];
            console.log(`Updated '${key}' with AI data.`);
          }
        }
      } catch (aiError) {
        console.error("An error occurred with the Gemini API call:", aiError);
        // You can decide how to handle this - maybe proceed with null data or show an error
      }
    }

    // ##################################################################
    // ## END OF NEW GEMINI AI INTEGRATION LOGIC ##
    // ##################################################################

    // --- Now we process the final data (which may have been filled by AI) ---

    // Handle potential null values and generate better image URLs
    let posterBetterSrc = scrapedData.posterSrc;
    if (posterBetterSrc) {
      const newDimensions = "-0-1000-0-1500-";
      posterBetterSrc = posterBetterSrc.replace(
        /-0-(\d+)-0-(\d+)-/,
        newDimensions
      );
    }

    let reviewerPicBetterSrc = scrapedData.reviewerPicSrc;
    if (reviewerPicBetterSrc) {
      const newDimensions = "-0-1000-0-1000-";
      reviewerPicBetterSrc = reviewerPicBetterSrc.replace(
        /-0-(\d+)-0-(\d+)-/,
        newDimensions
      );
    }

    // Update the final data object with better image sources
    scrapedData.posterBetterSrc = posterBetterSrc;
    scrapedData.reviewerPicBetterSrc = reviewerPicBetterSrc;

    // Render the final result
    const renderedHTML = await new Promise((resolve, reject) => {
      res.render("result1", { data: scrapedData }, (err, html) => {
        if (err) reject(err);
        else resolve(html);
      });
    });

    res.render("result", {
      data: {
        ...scrapedData,
        renderedHTML,
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

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});
