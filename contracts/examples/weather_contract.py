# { "Depends": "py-genlayer:test" }

from genlayer import *
import json
import typing


class WeatherForecast(gl.Contract):
    city: str
    latitude: str
    longitude: str
    temperature: str
    description: str
    wind_speed: str

    def __init__(self, city: str, latitude: str, longitude: str):
        self.city = city
        self.latitude = latitude
        self.longitude = longitude
        self.temperature = ""
        self.description = ""
        self.wind_speed = ""

    @gl.public.write
    def update_weather(self) -> typing.Any:
        lat = self.latitude
        lon = self.longitude
        city = self.city
        url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon + "&current_weather=true"

        def nondet() -> str:
            web_data = gl.get_webpage(url, mode="text")
            print(web_data)

            task = f"""Extract the current weather from this JSON response for {city}.

JSON data:
{web_data}

Respond with ONLY this JSON format:
{{
    "temperature": str,
    "wind_speed": str,
    "description": str
}}

For description, interpret WMO weather code:
0 = Clear sky, 1-3 = Partly cloudy, 45-48 = Fog,
51-55 = Drizzle, 61-65 = Rain, 71-77 = Snow,
80-82 = Rain showers, 95-99 = Thunderstorm.

It is mandatory that you respond only using the JSON format above, nothing else.
Don't include any other words or characters, your output must be only JSON
without any formatting prefix or suffix.
This result should be perfectly parsable by a JSON parser without errors.
"""
            result = gl.exec_prompt(task)
            result = result.replace("```json", "").replace("```", "").strip()
            print(result)
            return json.dumps(json.loads(result), sort_keys=True)

        result_str = gl.eq_principle_strict_eq(nondet)
        parsed = json.loads(result_str)

        self.temperature = parsed["temperature"]
        self.description = parsed["description"]
        self.wind_speed = parsed["wind_speed"]

        return parsed

    @gl.public.view
    def get_weather(self) -> typing.Any:
        return {
            "city": self.city,
            "temperature": self.temperature,
            "description": self.description,
            "wind_speed": self.wind_speed,
        }
