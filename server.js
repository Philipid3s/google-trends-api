const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();
const port = 3000; // Choose the port you want to run the API on

const baseURL = `https://trends.google.com`;

async function fillTrendsDataFromPage(page) {
  while (true) {
    const isNextPage = await page.$(".feed-load-more-button");
    if (!isNextPage) break;
    await page.click(".feed-load-more-button");
    await page.waitForTimeout(2000);
  }
  const dataFromPage = await page.evaluate((baseURL) => {
    return Array.from(document.querySelectorAll(".feed-item")).map((el) => ({
      index: el.querySelector(".index")?.textContent.trim(),
      title: Array.from(el.querySelectorAll(".title a"))
        .map((el) => el.getAttribute("title"))
        .join(" • "),
      titleLinks: Array.from(el.querySelectorAll(".title a")).map((el) => ({
        [el.getAttribute("title")]: `${baseURL}${el.getAttribute("href")}`,
      })),
      subtitle: el.querySelector(".summary-text a")?.textContent.trim(),
      subtitleLink: el.querySelector(".summary-text a")?.getAttribute("href"),
      source: el.querySelector(".source-and-time span:first-child")?.textContent.trim(),
      published: el.querySelector(".source-and-time span:last-child")?.textContent.trim(),
      thumbnail: `https:${el.querySelector(".feed-item-image-wrapper img")?.getAttribute("src")}`,
    }));
  }, baseURL);
  return dataFromPage;
}

app.get("/api/google-trends-realtime/:countryCode/:category", async (req, res) => {
  const { countryCode, category } = req.params; // Get the parameters from the URL

  const browser = await puppeteer.launch({
    headless: true, // Change to true for headless mode
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 700 });

  const URL = `${baseURL}/trends/trendingsearches/realtime?geo=${countryCode}&category=${category}&hl=en`;

  try {
    await page.goto(URL);
    await page.waitForSelector(".feed-item");
    const realtimeResults = await fillTrendsDataFromPage(page);
    res.json(realtimeResults);
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(500).json({ error: "An error occurred" });
  } finally {
    await browser.close();
  }
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
