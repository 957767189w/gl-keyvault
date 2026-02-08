# { "Depends": "py-genlayer:test" }

from genlayer import *
import json
import typing


class NewsSentiment(gl.Contract):
    topic: str
    sentiment: str
    confidence: str
    summary: str

    def __init__(self, topic: str):
        self.topic = topic
        self.sentiment = "unknown"
        self.confidence = "none"
        self.summary = ""

    @gl.public.write
    def analyze(self) -> typing.Any:
        topic = self.topic
        url = "https://www.bbc.com/search?q=" + topic

        def nondet() -> str:
            web_data = gl.get_webpage(url, mode="text")
            print(web_data)

            task = f"""Analyze the sentiment of news coverage about "{topic}"
based on the following web page content from BBC search results.

Web page content:
{web_data}
End of web page data.

Respond with ONLY this JSON format:
{{
    "sentiment": str,
    "confidence": str,
    "summary": str
}}

Where:
- sentiment is one of: "positive", "negative", "neutral", "mixed"
- confidence is one of: "high", "medium", "low"
- summary is a one-sentence description of the overall tone

It is mandatory that you respond only using the JSON format above, nothing else.
Don't include any other words or characters, your output must be only JSON
without any formatting prefix or suffix.
This result should be perfectly parsable by a JSON parser without errors.
"""
            result = gl.exec_prompt(task)
            result = result.replace("```json", "").replace("```", "").strip()
            print(result)
            return json.dumps(json.loads(result), sort_keys=True)

        result_str = gl.eq_principle_prompt_comparative(
            nondet,
            "Results are equivalent if the sentiment direction and confidence level match"
        )
        parsed = json.loads(result_str)

        self.sentiment = parsed["sentiment"]
        self.confidence = parsed["confidence"]
        self.summary = parsed.get("summary", "")

        return parsed

    @gl.public.write
    def update_topic(self, new_topic: str) -> None:
        self.topic = new_topic

    @gl.public.view
    def get_analysis(self) -> typing.Any:
        return {
            "topic": self.topic,
            "sentiment": self.sentiment,
            "confidence": self.confidence,
            "summary": self.summary,
        }
