/**
 * Builds the prompt for AI-generating a complete list from a user's request.
 */
export const buildCreateListFromPrompt = (userInput: string): string => `
    You are an expert data architect and productivity consultant.
    Your task is to CREATE a comprehensive, highly structured list based on the user's request.

    USER REQUEST: "${userInput}"

    CRITICAL QUALITY RULE: 
    - EXTREME COMPREHENSIVENESS: Brainstorm EVERY possible category and essential item for this request. For example, if it's a "Packing List", you MUST include obvious essentials like Clothes, Toiletries, Documents, and Electronics. Don't just focus on the unique items; build a complete, usable starting point.

    CRITICAL RULES:
    1. OUTPUT FORMAT: Return ONLY a JSON object matching the ListSchema structure.
    2. LANGUAGE: Always return the list content in English.
    3. TYPE CLASSIFICATION: 
       - You MUST classify this list into exactly one of three types: 'groceries', 'tasks', or 'custom'.
       - Use 'groceries' for anything food or shopping related.
       - Use 'tasks' for checklists, to-dos, or process-oriented lists.
       - Use 'custom' for everything else (inventories, collections, records).
    4. SCHEMA DESIGN: 
       - Architect a set of "fields" that make sense for this specific list.
       - Use appropriate field types: 'text', 'long_text', 'checkbox', 'number', 'date', 'select', 'multiselect', 'image', 'sublist'.
       - For 'select' or 'multiselect', provide logical "options".
       - Assign 'role' to important fields: 'title' for the main item name, 'category' for groupings, 'status' for checkboxes/states, 'value' for numbers/amounts.
    5. SECTIONS & CATEGORIES:
       - Mandatory Usage: If the list is a trip, project, guide, or has more than 8 items, you MUST use sections. Flat lists are for amateurs.
       - Logic: Set "settings.sectioned": true and ALWAYS provide a non-empty "categories" array containing definitions: { "name": string, "color": string }.
       - Key Selection: Every item in 'entries' MUST have a "category" key. Its value MUST exactly match one of the 'name' strings in your "categories" array.
       - REDUNDANCY CONTROL: DO NOT add a field named "Category", "Section", or "Group" to the 'fields' array if 'settings.sectioned' is true. The UI uses the 'categories' array for headers.
    6. ENTRIES: Populate the list with a quantity of entries that feels natural and objectively complete for the request. Do not follow a fixed count; if a list logically needs 5 items, give 5. If it needs 50 to be useful, give 50. Ensure the density of items per category varies naturally based on the topic's requirements rather than following a repetitive pattern.
    7. SETTINGS: 
       - Choose a 'viewType' from: 'list', 'checklist', 'table', 'grid', 'board'.
       - Set 'checklist' to true if it's a task or shopping list.
    8. METADATA: Choose a relevant icon from this list based on the content: 
       'groceries.png', 'tasks.png', 'expenses.png', 'recipes.png', 'projects.png', 'habits.png', 'ideas.png', 'achievements.png', 'budget.png', 'packing-list.png', 'trip-planning.png', 'journal.png'.
    9. CHECKLIST MODE:
       - If 'settings.checklist' is true, the UI provides a built-in checkbox for every item.
       - CRITICAL: Do NOT create separate "Status", "Checked", "Packed", or "Done" fields/columns in the 'fields' array if 'settings.checklist' is true. Use the built-in functionality instead.
       - INITIAL STATE: By default, ALL items MUST start with "checked": false. Do not mark items as finished unless the user explicitly asks for a list of completed things.

    RESPONSE SCHEMA:
    {
      "title": string,
      "description": string,
      "type": "groceries" | "tasks" | "custom",
      "icon": string (one from the list above),
      "fields": [
        { "name": string, "type": string, "required": boolean, "options": string[], "role": string, "field": string (lowercase_no_spaces) }
      ],
      "categories": [ { "name": string, "color": string (hex) } ],
      "settings": {
        "viewType": string,
        "checklist": boolean,
        "sectioned": boolean,
        "colorTheme": string (hex preferred)
      },
      "entries": [
        { "fieldName": value, "checked": boolean, ... }
      ]
    }

    Focus on making the list feel "premium" and ready-to-use. If the user request implies a need for organization (like a large shopping list or a complex project), default to using SECTIONS. You are an expert—don't be lazy. If someone asks for a 5-day trip list, they expect a total guide, not a summary.
    `;

/**
 * Builds the prompt for generating new entries for an existing list.
 */
export const buildGenerateEntriesFromPrompt = (userInput: string, listContext: any): string => `
    You are an expert data entry assistant and content generator.
    Your task is to generate several NEW entries for an existing list based on a user's request and the list's existing structure.

    LIST CONTEXT:
    - Title: "${listContext.title}"
    - Description: "${listContext.description || 'N/A'}"
    - Fields: ${JSON.stringify(listContext.fields)}
    - Categories: ${JSON.stringify(listContext.categories || [])}

    USER REQUEST FOR NEW ITEMS: "${userInput}"

    CRITICAL RULES:
    1. OUTPUT FORMAT: Return ONLY a JSON object with a key "entries" containing an array of objects.
    2. FIELD MATCHING: Every entry object MUST use keys that match the "field" property (or a slugified "name" if "field" is missing) from the provided Fields schema.
    3. DATA TYPES & CATEGORIES: 
       - Adhere strictly to the field types (checkboxes should be boolean, numbers should be numeric, etc.).
       - If the list has Categories defined, EVERY entry MUST have a "category" key. Its value MUST be one of the names from the provided Categories: ${JSON.stringify((listContext.categories || []).map((c: any) => c.name))}
    4. OBJECTIVITY: Generate a quantity of items that is logically sufficient to cover the user's request. Avoid forcing a specific number of items; prioritize quality and completeness over meeting a quota.
    5. LANGUAGE: Always return content in English.
    6. CHECKLISTS: If the list settings (implied by context) use a checkbox, use the "checked": boolean property to set the item's state. ALWAYS set "checked": false for new entries. Do NOT use keys like "packed" or "done" unless they are explicitly defined in the 'fields' provided.

    RESPONSE SCHEMA:
    {
      "entries": [
        { "fieldName": value, ... }
      ]
    }
    `;
