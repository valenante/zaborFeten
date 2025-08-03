// src/api/publicApi.js
import axios from 'axios';

const publicApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  withCredentials: false,
});

export default publicApi;
