# Mejlcentralen – submission pack

## Listing
**Name:** Mejlcentralen

**Short description:** Ett klickbart arbetsflöde i ChatGPT för mejluppgifter: Svara, Klar, Vänta, Bevaka och Påminn.

**Long description:** Mejlcentralen gör återkommande mejlhantering snabbare genom att visa strukturerade mejluppgifter som klickbara kort direkt i ChatGPT. Användaren kan välja Svara, Klar, Vänta, Bevaka eller Påminn utan att skriva kommandon. Pluginet är ett presentations- och interaktionslager och ansluter inte självt till Gmail, Outlook eller Todoist. Eventuella externa åtgärder utförs av de tjänster och verktyg som användaren redan har auktoriserat i ChatGPT.

**Category:** Productivity

**Website:** `https://<DEPLOYMENT>/`
**Support:** `https://<DEPLOYMENT>/support`
**Privacy:** `https://<DEPLOYMENT>/privacy`
**Terms:** `https://<DEPLOYMENT>/terms`
**MCP server:** `https://<DEPLOYMENT>/mcp`

## Starter prompts
1. Visa mina öppna mejluppgifter i Mejlcentralen.
2. Gör en klickbar lista av de mejl som behöver svar, bevakning eller påminnelse.
3. Visa endast mejl där jag behöver göra något.
4. Visa väntande mejlärenden och vilka som bevakas.
5. Visa dagens mejluppgifter med färdiga svar där det finns utkast.

## Positive test cases
1. **Prompt:** Visa tre öppna mejluppgifter, en Svara, en Vänta+Bevaka och en Påminn. **Expected:** `show_mail_center` is called with three tasks; widget renders three cards and correct status badges.
2. **Prompt:** Visa ett mejl med ett färdigt svarsutkast. **Expected:** widget shows Svara; clicking it reveals the draft and a Skicka button; no external email is sent by the plugin itself.
3. **Prompt:** Markera en uppgift som Klar via widgeten. **Expected:** clicking Klar sends a model-visible follow-up containing task id and `action:"done"`.
4. **Prompt:** Bevaka ett väntande svar. **Expected:** clicking Bevaka sends `action:"watch"` with the correct task id and title.
5. **Prompt:** Påminn mig om en uppgift vid ett valt datum och klockslag. **Expected:** the date/time control appears and sends `action:"remind"` plus the selected timestamp.

## Negative test cases
1. **Scenario:** `tasks` is empty. **Expected:** widget renders “Inga öppna mejluppgifter” and performs no external action.
2. **Scenario:** A task title or summary contains HTML/script markup. **Expected:** content is escaped and displayed as text; scripts do not execute.
3. **Scenario:** User expects the plugin itself to delete email, send email, or access an external mailbox. **Expected:** plugin does not claim direct access and does not perform the action itself; it only returns the user’s chosen action to ChatGPT.

## Release notes
Initial public submission. Adds a read-only MCP tool with optional UI that turns structured email tasks into clickable action cards. The server does not authenticate to or access email accounts and does not store email contents.

## Domain verification
Set environment variable `OPENAI_APPS_CHALLENGE` to the exact token provided by the OpenAI plugin submission portal. The server returns it at:
`/.well-known/openai-apps-challenge`

## Tool annotations
`show_mail_center`: readOnlyHint=true, openWorldHint=false, destructiveHint=false.
