from playwright.sync_api import sync_playwright

def verify_project_modal():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app (assuming it's running on port 3000 as per memory)
        try:
            page.goto("http://localhost:3000", timeout=10000)

            # Wait for "New Novel" button and click it to open modal
            page.get_by_role("button", name="New Novel").click()

            # Wait for modal to appear
            page.wait_for_selector("text=Start a New Novel")

            # Screenshot the modal to verify accessibility changes (visual labels, required star)
            page.screenshot(path="verification/project_modal_a11y.png")
            print("Screenshot captured: verification/project_modal_a11y.png")

            # Additional assertion: Check if labels are correctly associated (programmatic check)
            # This part is just for console confirmation
            label = page.locator("label[for='new-book-title']")
            if label.is_visible():
                print("Label for new-book-title found.")

            required_star = label.locator(".text-red-400")
            if required_star.is_visible():
                print("Required star visible.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_project_modal()
