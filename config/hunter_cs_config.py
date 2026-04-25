BASE_URL = "https://hunter-undergraduate.catalog.cuny.edu"

PROGRAM = {
    "college": "Hunter College",
    "major": "Computer Science BA",
    "program_url": f"{BASE_URL}/programs/COMPSCI-BA",
    "output_path": "./generated/hunter-cs-catalog.json",
}

REQUIREMENT_NAMES = {
    "overall": "Major Requirements - Overall",
    "math": "Major Requirements - Required Math Courses",
    "concentration": "Major Requirements - Computer Science Concentration",
}

ELECTIVE_COURSE_URLS = [
    f"{BASE_URL}/courses/0245151",
    f"{BASE_URL}/courses/0245231",
    f"{BASE_URL}/courses/0245541",
    f"{BASE_URL}/courses/0245561",
    f"{BASE_URL}/courses/0245651",
    f"{BASE_URL}/courses/0246091",
]

COURSE_OVERRIDES = {}
