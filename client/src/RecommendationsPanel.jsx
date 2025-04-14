import React, { useState, useEffect } from "react";
import axios from "axios";

const RecommendationsPanel = ({ userId, onSelect }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/recommendations/${userId}`
        );
        setRecommendations(response.data.recommendations || []);
      } catch (error) {
        console.error("Error fetching recommendations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [userId]);

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading recommendations...
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No recommendations yet. Start chatting to get suggestions.
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-500 mb-2">
        Suggested follow-ups
      </h3>
      <ul className="space-y-2">
        {recommendations.map((rec, index) => (
          <li key={index}>
            <button
              onClick={() => onSelect(rec)}
              className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {rec}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecommendationsPanel;
