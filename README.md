# FastMail Date Delimiters

A Firefox browser extension that adds visual date separators to your FastMail inbox, similar to Outlook's email grouping.

## What It Does

This extension enhances your FastMail inbox by:

- **Adding date delimiters** between emails from different days
- **Displaying date labels** (e.g., "Today", "Yesterday", or full dates like "November 21, 2025")
- **Automatically updating** when you scroll or switch folders
- **Working seamlessly** with FastMail's interface without disrupting email functionality

The delimiters appear as subtle blue bars with semi-transparent backgrounds, making it easy to visually separate emails by date at a glance.

## Installation

### Loading the Extension in Firefox

1. **Open Firefox** and navigate to `about:debugging#/runtime/this-firefox`

2. **Click "Load Temporary Add-on"**

3. **Navigate to the extension folder** and select the `manifest.json` file

4. The extension will load immediately and appear in the list of temporary extensions

5. **Open FastMail** at https://app.fastmail.com/mail/Inbox

6. **Date delimiters should appear automatically** between emails from different days

### Notes

- The extension loads as a **temporary add-on**, which means it will be removed when Firefox restarts
- To reload the extension after making changes, click the **reload button** in `about:debugging`
- The extension only works on FastMail pages (`app.fastmail.com/mail/*`)

## Files

- `manifest.json` - Extension configuration
- `content.js` - Main logic for detecting date changes and inserting delimiters
- `styles.css` - Visual styling for the date delimiters

## Customization

You can customize the appearance by editing `styles.css`:

- **Border color**: Change `border-top` color (default: `#007aff`)
- **Background color**: Change `background-color` (default: semi-transparent blue)
- **Text color**: Change `color` property
- **Height**: Adjust `height` property (default: `24px`)
- **Font**: Modify `font-size`, `font-weight`, etc.

After making changes, reload the extension in `about:debugging` and refresh FastMail.

## Browser Compatibility

This extension is designed for **Firefox** using Manifest V2. It has been tested with FastMail's current web interface as of November 2025.
