/*
Code from: https://github.com/n-k/dzi

Rust DZI implementation

Copyright (c) 2021, Nipun Kumar <nipunkumar@outlook.com>
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

    1. Redistributions of source code must retain the above copyright notice,
       this list of conditions and the following disclaimer.

    2. Redistributions in binary form must reproduce the above copyright
       notice, this list of conditions and the following disclaimer in the
       documentation and/or other materials provided with the distribution.

    3. The name or names of its contributors may be used
       to endorse or promote products derived from this software without
       specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

*/

use std::io::Write;
use std::path::{Path, PathBuf};

use image::{DynamicImage, GenericImageView, ImageError};

#[derive(thiserror::Error, Debug)]
pub enum TilingError {
    #[error("Unsupported source image: {0}")]
    UnsupportedSourceImage(String),
    #[error("Unexpected error")]
    UnexpectedError,
    #[error("Unsupported source image: {0}")]
    ImageError(#[from] ImageError),
    #[error("IO error: {0}")]
    IOError(#[from] std::io::Error),
}

pub type DZIResult<T, E = TilingError> = Result<T, E>;

/// A tile creator, this struct and associated functions
/// implement the DZI tiler
pub struct TileCreator {
    /// path of destination directory where tiles will be stored
    pub dest_path: PathBuf,
    /// source image
    pub image: DynamicImage,
    /// size of individual tiles in pixels
    pub tile_size: u32,
    /// number of pixels neighboring tiles overlap
    pub tile_overlap: u32,
    /// total number of levels of tiles
    pub levels: u32,

    pub format: String,
}

impl TileCreator {
    /// Create DZI tiles
    pub fn create_tiles(&self) -> DZIResult<()> {
        for l in 0..self.levels {
            self.create_level(l)?;
        }

        Ok(())
    }

    /// Check if level is valid
    fn check_level(&self, l: u32) -> DZIResult<()> {
        if l >= self.levels {
            return Err(TilingError::UnexpectedError);
        }
        Ok(())
    }

    /// Create tiles for a level
    fn create_level(&self, level: u32) -> DZIResult<()> {
        let p = self.dest_path.join(format!("{}", level));
        std::fs::create_dir_all(&p)?;
        let mut li = self.get_level_image(level)?;
        let (c, r) = self.get_tile_count(level)?;
        for col in 0..c {
            for row in 0..r {
                let (x, y, x2, y2) = self.get_tile_bounds(level, col, row)?;
                let tile_image = li.crop(x, y, x2 - x, y2 - y);
                let tile_path = p.join(format!("{}_{}.{}", col, row, self.format));
                tile_image.save(tile_path)?;
            }
        }
        Ok(())
    }

    /// Get image for a level
    fn get_level_image(&self, level: u32) -> DZIResult<DynamicImage> {
        self.check_level(level)?;
        let (w, h) = self.get_dimensions(level)?;
        Ok(self
            .image
            .resize(w, h, image::imageops::FilterType::Nearest))
    }

    /// Get scale factor at level
    fn get_scale(&self, level: u32) -> DZIResult<f64> {
        self.check_level(level)?;
        Ok(0.5f64.powi((self.levels - 1 - level) as i32))
    }

    /// Get dimensions (width, height) in pixels of image for level
    fn get_dimensions(&self, level: u32) -> DZIResult<(u32, u32)> {
        self.check_level(level)?;
        let s = self.get_scale(level)?;
        let (w, h) = self.image.dimensions();
        let h = (h as f64 * s).ceil() as u32;
        let w = (w as f64 * s).ceil() as u32;
        Ok((w, h))
    }

    /// Get (number of columns, number of rows) for a level
    fn get_tile_count(&self, l: u32) -> DZIResult<(u32, u32)> {
        let (w, h) = self.get_dimensions(l)?;
        let cols = (w as f64 / self.tile_size as f64).ceil() as u32;
        let rows = (h as f64 / self.tile_size as f64).ceil() as u32;
        Ok((cols, rows))
    }

    fn get_tile_bounds(&self, level: u32, col: u32, row: u32) -> DZIResult<(u32, u32, u32, u32)> {
        let offset_x = if col == 0 { 0 } else { self.tile_overlap };
        let offset_y = if row == 0 { 0 } else { self.tile_overlap };
        let x = col * self.tile_size - offset_x;
        let y = row * self.tile_size - offset_y;

        let (lw, lh) = self.get_dimensions(level)?;

        let w = self.tile_size + (if col == 0 { 1 } else { 2 }) * self.tile_overlap;
        let h = self.tile_size + (if row == 0 { 1 } else { 2 }) * self.tile_overlap;

        let w = w.min(lw - x);
        let h = h.min(lh - y);
        Ok((x, y, x + w, y + h))
    }
}
