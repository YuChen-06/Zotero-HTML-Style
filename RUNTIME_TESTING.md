# Zotero 9 Runtime Testing Guide

## Overview

This document describes how to test the Zotero Theme Switcher plugin on Zotero 9. The test build has `strict_max_version: "9.*"` to allow installation on Zotero 9.

**Important**: This is a TEST-ONLY build. Do not distribute or publish until testing is complete.

## Prerequisites

- Zotero 9.0.4 or later installed
- A test Zotero profile (NOT your main library)
- The test-only XPI file: `.scaffold/build/zotero-theme-switcher.xpi`

## Step 1: Create a Test Profile

1. Close Zotero completely
2. Open a terminal/command prompt
3. Run: `"C:\Program Files\Zotero\zotero.exe" -P`
4. Click "Create Profile" and name it "ThemeSwitcherTest"
5. Select the new profile and click "Start Zotero"

## Step 2: Install the Test XPI

1. In Zotero, go to Tools → Add-ons
2. Click the gear icon → Install Add-on From File...
3. Navigate to `.scaffold/build/zotero-theme-switcher.xpi`
4. Click "Install"
5. Restart Zotero when prompted

## Step 3: Verify Installation

1. Go to Tools → Add-ons
2. Verify "Zotero Theme Switcher" appears in the list
3. Check that it shows as "Enabled" (not "Incompatible")

## Step 4: Test Theme Switching

1. Create a new item in your test library
2. Add an HTML attachment (e.g., save a webpage)
3. Open the HTML attachment in the Reader
4. Look for the theme button in the Reader toolbar (paintbrush icon)
5. Click the button to open the theme menu
6. Select different themes and verify the colors change

## Step 5: Test Preferences

1. Go to Tools → Add-ons
2. Find "Zotero Theme Switcher" and click "Options" or "Preferences"
3. Verify the preferences panel loads
4. Test changing the default theme
5. Test changing the click behavior (menu vs cycle)
6. Test adding custom CSS variables

## Step 6: Check Debug Output

1. Go to Help → Debug Output Logging → Start
2. Perform the theme switching tests again
3. Go to Help → Debug Output Logging → View Output
4. Look for lines starting with "Theme Switcher:"
5. Expected debug messages:
   - "Theme Switcher: startup begin"
   - "Theme Switcher: startup complete"
   - "renderToolbar event received"
   - "applyToReader: applying theme X"
   - "Theme Switcher: shutdown begin"
   - "Theme Switcher: shutdown complete"

## Step 7: Test Hot Reload

1. Open multiple HTML attachments in the Reader
2. Change the theme in preferences
3. Verify all open Readers update automatically

## Step 8: Test Cleanup

1. Close all Reader tabs
2. Go to Tools → Add-ons
3. Disable "Zotero Theme Switcher"
4. Restart Zotero
5. Verify no errors appear in debug output

## Test Results Table

| Test | Result | Notes |
|------|--------|-------|
| Zotero Version | | |
| OS | | |
| XPI Installed | | |
| Plugin Enabled | | |
| Theme Button Visible | | |
| Theme Menu Works | | |
| Theme Changes Apply | | |
| Preferences Load | | |
| Hot Reload Works | | |
| Debug Output Clean | | |
| Shutdown Clean | | |

## Troubleshooting

### Plugin shows as "Incompatible"

- Check that the XPI was built with `strict_max_version: "9.*"`
- Verify the XPI file is the test-only build

### Theme button doesn't appear

- Check debug output for errors
- Verify you're opening an HTML attachment (not PDF)
- Try restarting Zotero

### Theme doesn't change

- Check debug output for "applyToReader" messages
- Verify the HTML document is loaded in the Reader
- Try closing and reopening the Reader tab

### Preferences don't load

- Check debug output for errors
- Try disabling and re-enabling the plugin

## Next Steps

After testing is complete:

1. If all tests pass: Update `strict_max_version` to `"9.*"` in the main branch
2. If tests fail: Document the failures and create issues for fixing
3. Create a GitHub Release with the tested XPI
