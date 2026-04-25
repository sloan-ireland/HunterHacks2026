import time
import json
import re
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

def scrape_all_hunter_cs():
    # Hardcoding CSCI since we are doing a mass scrape of the department
    subject_code = "CSCI"
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=500)
        context = browser.new_context(viewport={'width': 1280, 'height': 1000})
        page = context.new_page()
        
        print("🌐 Opening CUNY Search...")
        page.goto("https://globalsearch.cuny.edu/CFGlobalSearchTool/CFSearchToolController")

        # --- STEP 1 & 2: INSTITUTION & TERM ---
        print("📍 Selecting Hunter College & Fall 2026...")
        try:
            page.get_by_text("Hunter College", exact=True).click(force=True)
            page.locator('select[id="t_pd"]').select_option("1269", force=True)
            page.locator('input[value="Next"]').click(force=True)
            page.wait_for_load_state("networkidle")
        except Exception as e:
            print(f"❌ Landing page error: {e}")
            return

        # --- STEP 3: AJAX SMART WAIT ---
        print("⏳ Waiting for Subjects to load from server...")
        try:
            page.wait_for_function('''() => {
                let select = document.getElementById('subject_ld');
                return select && select.options.length > 5; 
            }''', timeout=15000)
            print("✅ Subject list successfully loaded.")
        except:
            print("❌ Timeout: The subject list never populated.")
            browser.close()
            return

        # --- STEP 4: THE BROAD SEARCH ---
        actual_value = page.evaluate('''([subject_code]) => {
            let select = document.getElementById('subject_ld');
            let fallback_search = "Computer Science"; 
            for (let opt of select.options) {
                if (opt.text.toUpperCase().includes(subject_code) || opt.value.toUpperCase() === subject_code || opt.text.toUpperCase().includes(fallback_search.toUpperCase())) {
                    return opt.value; 
                }
            }
            return null;
        }''', [subject_code])

        if actual_value:
            print(f"🎉 Matched '{subject_code}'. Executing BROAD SEARCH for all courses...")
            page.locator('select[id="subject_ld"]').select_option(actual_value)
            
            # WE LEAVE COURSE NUMBER BLANK ON PURPOSE
            print("🔍 Clicking Search...")
            page.locator('input[id*="search" i], input[value="Search" i], button[type="submit"]').first.click()
            
            # --- STEP 5: WAIT FOR THE MASSIVE GRID ---
            print("📊 Waiting for the massive catalog grid to load (this may take a while)...")
            page.wait_for_load_state("networkidle", timeout=60000)
            page.wait_for_selector('table.classinfo', state="attached", timeout=30000)
            print("🏆 SUCCESS! Full catalog is in the DOM.")
            
            # --- STEP 6: ROBUST LINK HARVESTING (BeautifulSoup) ---
            print("🔗 Harvesting course links via BeautifulSoup...")
            
            soup = BeautifulSoup(page.content(), "lxml")
            course_links = {}
            
            # Find every single text node on the page that looks like "CSCI 127" or "CSCI 12700"
            headers = soup.find_all(string=re.compile(rf"{subject_code}\s*\d+", re.IGNORECASE))
            
            for header in headers:
                header_text = " ".join(header.strip().split()) # Clean up weird spacing
                
                # Extract just the base course ID (e.g., "CSCI 12700" -> "CSCI 12700")
                match = re.search(r'(CSCI\s*\d+)', header_text, re.IGNORECASE)
                if not match: 
                    continue
                    
                base_course = match.group(1).upper()
                
                # If we already have a link for this course, skip it to avoid duplicates
                if base_course in course_links:
                    continue
                    
                # Use BS4's superpower: walk forward until you hit the first data table
                next_table = header.find_next("table", class_="classinfo")
                if next_table:
                    link = next_table.find("a")
                    if link and link.has_attr("href"):
                        course_links[base_course] = {
                            "title": header_text,
                            "href": link["href"]
                        }

            print(f"🎯 Found {len(course_links)} unique courses to scrape!")
            
            # --- STEP 7: THE MULTI-TAB EXTRACTION LOOP ---
            master_json = []
            base_url = "https://globalsearch.cuny.edu/CFGlobalSearchTool/"
            
            print("\n🚀 INITIATING MASS EXTRACTION PROTOCOL...\n")
            
            for course_id, data in course_links.items():
                print(f"⚙️ Scraping data for {course_id}... ({data['title'][:40]}...)")
                
                detail_page = context.new_page()
                full_url = base_url + data['href']
                
                try:
                    detail_page.goto(full_url)
                    detail_page.wait_for_load_state("networkidle")
                    
                    modal_text = detail_page.locator('body').inner_text()
                    
                    course_obj = {
                        "course_name": course_id,
                        "title_name": data['title'],
                        "prerequisites": None,
                        "corequisites": None
                    }
                    
                    # Regex Extraction
                    stop_words = r'(?:Requirement Designation|Class Attributes|Class Availability|Class Notes|Description|$)'
                    enroll_req_match = re.search(rf'Enrollment Requirements\s*:?\s*(.*?){stop_words}', modal_text, re.IGNORECASE | re.DOTALL)
                    prereq_match = re.search(rf'Prereq[a-z]*\s*:?\s*(.*?){stop_words}', modal_text, re.IGNORECASE | re.DOTALL)
                    coreq_match = re.search(rf'Coreq[a-z]*\s*:?\s*(.*?)(?:Prereq|{stop_words})', modal_text, re.IGNORECASE | re.DOTALL)

                    if prereq_match:
                        course_obj["prerequisites"] = re.sub(r'\s+', ' ', prereq_match.group(1).strip())
                    elif enroll_req_match:
                        course_obj["prerequisites"] = re.sub(r'\s+', ' ', enroll_req_match.group(1).strip())
                        
                    if coreq_match:
                        course_obj["corequisites"] = re.sub(r'\s+', ' ', coreq_match.group(1).strip())
                        
                    master_json.append(course_obj)
                    
                except Exception as e:
                    print(f"❌ Failed to scrape {course_id}: {e}")
                finally:
                    detail_page.close()
                    time.sleep(1) # Polite pause so we don't accidentally DDoS CUNY

            # --- STEP 8: SAVE THE MASTER DATABASE ---
            print("\n--- 📦 MASTER JSON DATABASE GENERATED ---")
            with open("ALL_CSCI_COURSES.json", "w") as f:
                json.dump(master_json, f, indent=4)
            print("💾 Saved successfully to ALL_CSCI_COURSES.json")

        else:
            print(f"\n❌ Could not find '{subject_code}' in the system.")

        print("\n🏁 Script complete. Closing in 2 seconds...")
        time.sleep(2)
        browser.close()

# Start the mass extraction!
scrape_all_hunter_cs()