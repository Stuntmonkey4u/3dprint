# 3D Print Cost Calculator

## Project Overview

This is a self-contained, full-stack 3D Print Cost Calculator Web Application, designed to run entirely within Docker. The app supports two operation modes — Consumer Mode and Business Mode — each with tailored features and workflows.

The purpose of this tool is to allow users (consumers or businesses) to upload a G-code or STL file and get a detailed print cost calculation based on filament type, print time, and user-configurable parameters like material cost, energy cost, and labor.

## Tech Stack

*   **Frontend:** React
*   **Backend:** Flask (Python)
*   **Containerization:** Docker

## Getting Started

### Prerequisites

*   Docker installed on your machine.

### Building and Running the Application

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/3d-print-calculator.git
    cd 3d-print-calculator
    ```

2.  **Build the Docker image:**
    ```bash
    docker build -t 3d-print-calculator .
    ```

3.  **Run the Docker container:**
    ```bash
    docker run -d -p 5000:5000 3d-print-calculator
    ```

4.  **Access the application:**
    Open your web browser and navigate to `http://localhost:5000`.

## Features (Phase 1 - MVP)

*   Upload `.gcode` and `.stl` files.
*   Calculate print cost based on material usage and optional energy consumption.
*   Select from a list of common filament types.
*   Enter a custom filament cost.
*   Secure and containerized with Docker.
