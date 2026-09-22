import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const baseURL=process.env.BASE_URL||"http://127.0.0.1:4173";
const criticalRoutes=[
  "/index.html",
  "/item.html",
  "/404.html"
];

test("rotas HTML críticas respondem",async({request})=>{
  for(const route of criticalRoutes){
    const response=await request.get(baseURL+route);
    expect(
      response.status(),
      `${route} deveria responder 200`
    ).toBe(200);

    const contentType=response.headers()["content-type"]||"";
    expect(
      contentType,
      `${route} deveria ser HTML`
    ).toContain("text/html");
  }
});

test("shell principal renderiza sem recurso local quebrado",async({page})=>{
  const localOrigin=new URL(baseURL).origin;
  const localFailures=[];

  page.on("response",response=>{
    const url=new URL(response.url());
    if(
      url.origin===localOrigin &&
      response.status()>=400
    ){
      localFailures.push({
        url:response.url(),
        status:response.status()
      });
    }
  });

  await page.goto(baseURL+"/index.html",{
    waitUntil:"domcontentloaded",
    timeout:20000
  });

  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("#loginScreen")).toHaveCount(1);

  // Dá tempo para scripts defer e recursos locais terminarem de carregar.
  await page.waitForTimeout(800);

  expect(localFailures,"Recursos locais quebrados").toEqual([]);
});

test("página 404 customizada existe",async({request})=>{
  const response=await request.get(baseURL+"/404.html");
  expect(response.status()).toBe(200);
  const html=await response.text();
  expect(html).toContain("Página não encontrada");
});


test("skip link recebe foco pelo teclado",async({page})=>{
  await page.goto(baseURL+"/index.html",{
    waitUntil:"domcontentloaded",
    timeout:20000
  });

  const skip=page.locator(".skip-link");
  await expect(skip).toHaveCount(1);
  await expect(page.locator("#mainContent")).toHaveCount(1);

  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
});

test("sem violações críticas de acessibilidade",async({page})=>{
  await page.goto(baseURL+"/index.html",{
    waitUntil:"domcontentloaded",
    timeout:20000
  });

  const results=await new AxeBuilder({page})
    .withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"])
    .analyze();

  const critical=results.violations
    .filter(item=>item.impact==="critical")
    .map(item=>({
      id:item.id,
      help:item.help,
      nodes:item.nodes.map(node=>node.target)
    }));

  expect(critical).toEqual([]);
});
