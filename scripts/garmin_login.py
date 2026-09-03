import dataclasses
import datetime
import json
import os
import sys

import garth.sso

username = os.environ.get("GARMIN_USERNAME")
password = os.environ.get("GARMIN_PASSWORD")

if not username or not password:
    print("Set GARMIN_USERNAME and GARMIN_PASSWORD env vars before running.", file=sys.stderr)
    sys.exit(1)

oauth1, oauth2 = garth.sso.login(username, password)

oauth1_dict = dataclasses.asdict(oauth1)
oauth2_dict = dataclasses.asdict(oauth2)
oauth2_dict["last_update_date"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
oauth2_dict["expires_date"] = datetime.datetime.fromtimestamp(
    oauth2_dict["expires_at"], tz=datetime.timezone.utc
).isoformat()

with open("garmin-tokens.json", "w") as f:
    json.dump({"oauth1": oauth1_dict, "oauth2": oauth2_dict}, f, indent=2)

print("Login succeeded. Tokens written to garmin-tokens.json")
